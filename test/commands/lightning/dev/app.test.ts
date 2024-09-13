/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import path from 'node:path';
import { Config as OclifConfig } from '@oclif/core';
import { Config as SfConfig, Messages, Connection } from '@salesforce/core';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import {
  AndroidDevice,
  AndroidOSType,
  AppleDevice,
  AppleOSType,
  CommonUtils,
  DeviceType,
  Setup as LwcDevMobileCoreSetup,
  Platform,
  SSLCertificateData,
  Version,
} from '@salesforce/lwc-dev-mobile-core';
import { stubSpinner, stubUx } from '@salesforce/sf-plugins-core';
import { expect } from 'chai';
import esmock from 'esmock';
import sinon from 'sinon';
import LightningDevApp, {
  androidSalesforceAppPreviewConfig,
  iOSSalesforceAppPreviewConfig,
} from '../../../../src/commands/lightning/dev/app.js';
import { OrgUtils } from '../../../../src/shared/orgUtils.js';
import { PreviewUtils } from '../../../../src/shared/previewUtils.js';
import { ConfigUtils, LocalWebServerIdentityData } from '../../../../src/shared/configUtils.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);

describe('lightning dev app', () => {
  const messages = Messages.loadMessages('@salesforce/plugin-lightning-dev', 'lightning.dev.app');
  const $$ = new TestContext();
  const testOrgData = new MockTestOrgData();
  const testAppId = '06m8b000002vpFSAAY';
  const testServerUrl = 'wss://localhost:1234';
  const testIOSDevice = new AppleDevice(
    'F2B4097F-F33E-4D8A-8FFF-CE49F8D6C166',
    'iPhone 15 Pro Max',
    DeviceType.mobile,
    AppleOSType.iOS,
    new Version(17, 5, 0)
  );
  const testAndroidDevice = new AndroidDevice(
    'Pixel_5_API_34',
    'Pixel 5 API 34',
    DeviceType.mobile,
    AndroidOSType.googleAPIs,
    new Version(34, 0, 0),
    false
  );
  const certData: SSLCertificateData = {
    derCertificate: Buffer.from('A', 'utf-8'),
    pemCertificate: 'B',
    pemPrivateKey: 'C',
    pemPublicKey: 'D',
  };
  let MockedLightningPreviewApp: typeof LightningDevApp;

  const fakeIdentityToken = 'PFT1vw8v65aXd2b9HFvZ3Zu4OcKZwjI60bq7BEjj5k4=';
  const fakeEntityId = '1I9xx0000004ClkCAE';
  const fakeIdentityData: LocalWebServerIdentityData = {
    identityToken: `${fakeIdentityToken}`,
    usernameToServerEntityIdMap: {},
  };
  fakeIdentityData.usernameToServerEntityIdMap[testOrgData.username] = fakeEntityId;

  beforeEach(async () => {
    stubUx($$.SANDBOX);
    stubSpinner($$.SANDBOX);
    await $$.stubAuths(testOrgData);

    $$.SANDBOX.stub(SfConfig, 'create').withArgs($$.SANDBOX.match.any).resolves(SfConfig.prototype);
    $$.SANDBOX.stub(SfConfig, 'addAllowedProperties').withArgs($$.SANDBOX.match.any);
    $$.SANDBOX.stub(SfConfig.prototype, 'get').returns(undefined);
    $$.SANDBOX.stub(SfConfig.prototype, 'set');
    $$.SANDBOX.stub(SfConfig.prototype, 'write').resolves();
    $$.SANDBOX.stub(ConfigUtils, 'getOrCreateIdentityToken').resolves(fakeIdentityToken);

    MockedLightningPreviewApp = await esmock<typeof LightningDevApp>('../../../../src/commands/lightning/dev/app.js', {
      '../../../../src/lwc-dev-server/index.js': {
        startLWCServer: async () => ({ stopServer: () => {} }),
      },
    });
  });

  afterEach(() => {
    $$.restore();
  });

  it('throws when app not found', async () => {
    try {
      $$.SANDBOX.stub(OrgUtils, 'getAppId').resolves(undefined);
      await MockedLightningPreviewApp.run(['--name', 'blah', '-o', testOrgData.username]);
    } catch (err) {
      expect(err)
        .to.be.an('error')
        .with.property('message', messages.getMessage('error.fetching.app-id', ['blah']));
    }
  });

  it('throws when username not found', async () => {
    try {
      $$.SANDBOX.stub(OrgUtils, 'getAppId').resolves(undefined);
      $$.SANDBOX.stub(Connection.prototype, 'getUsername').returns(undefined);
      await MockedLightningPreviewApp.run(['--name', 'blah', '-o', testOrgData.username]);
    } catch (err) {
      expect(err).to.be.an('error').with.property('message', messages.getMessage('error.username'));
    }
  });

  it('throws when cannot determine ldp server url', async () => {
    try {
      $$.SANDBOX.stub(OrgUtils, 'getAppId').resolves(testAppId);
      $$.SANDBOX.stub(PreviewUtils, 'generateWebSocketUrlForLocalDevServer').throws(
        new Error('Cannot determine LDP url.')
      );
      await MockedLightningPreviewApp.run(['--name', 'Sales', '-o', testOrgData.username]);
    } catch (err) {
      expect(err).to.be.an('error').with.property('message', 'Cannot determine LDP url.');
    }
  });

  describe('desktop dev', () => {
    it('runs org:open with proper flags when app name provided', async () => {
      await verifyOrgOpen(`lightning/app/${testAppId}`, 'Sales');
    });

    it('runs org:open with proper flags when no app name provided', async () => {
      await verifyOrgOpen('lightning');
    });

    async function verifyOrgOpen(expectedAppPath: string, appName?: string): Promise<void> {
      $$.SANDBOX.stub(OrgUtils, 'getAppId').resolves(testAppId);
      $$.SANDBOX.stub(PreviewUtils, 'generateWebSocketUrlForLocalDevServer').returns(testServerUrl);
      $$.SANDBOX.stub(ConfigUtils, 'getIdentityData').resolves(fakeIdentityData);

      const runCmdStub = $$.SANDBOX.stub(OclifConfig.prototype, 'runCommand').resolves();
      if (appName) {
        await MockedLightningPreviewApp.run(['--name', appName, '-o', testOrgData.username]);
      } else {
        await MockedLightningPreviewApp.run(['-o', testOrgData.username]);
      }

      expect(runCmdStub.calledOnce);
      expect(runCmdStub.getCall(0).args).to.deep.equal([
        'org:open',
        [
          '--path',
          `${expectedAppPath}?0.aura.ldpServerUrl=${testServerUrl}&0.aura.ldpServerId=${fakeEntityId}&0.aura.mode=DEVPREVIEW`,
          '--target-org',
          testOrgData.username,
        ],
      ]);
    }
  });

  describe('mobile dev', () => {
    it('throws when environment setup requirements are not met', async () => {
      $$.SANDBOX.stub(OrgUtils, 'getAppId').resolves(testAppId);
      $$.SANDBOX.stub(PreviewUtils, 'generateWebSocketUrlForLocalDevServer').returns(testServerUrl);
      $$.SANDBOX.stub(PreviewUtils, 'getEntityId').resolves(fakeEntityId);

      $$.SANDBOX.stub(LwcDevMobileCoreSetup.prototype, 'init').resolves();
      $$.SANDBOX.stub(LwcDevMobileCoreSetup.prototype, 'run').rejects(new Error('Requirement blah not met'));

      await verifyMobileThrowsWithUnmetRequirements(Platform.ios);
      await verifyMobileThrowsWithUnmetRequirements(Platform.android);
    });

    it('throws when unable to fetch mobile device', async () => {
      $$.SANDBOX.stub(OrgUtils, 'getAppId').resolves(testAppId);
      $$.SANDBOX.stub(PreviewUtils, 'generateWebSocketUrlForLocalDevServer').returns(testServerUrl);
      $$.SANDBOX.stub(PreviewUtils, 'getEntityId').resolves(fakeEntityId);

      $$.SANDBOX.stub(LwcDevMobileCoreSetup.prototype, 'init').resolves();
      $$.SANDBOX.stub(LwcDevMobileCoreSetup.prototype, 'run').resolves();

      $$.SANDBOX.stub(PreviewUtils, 'getMobileDevice').resolves(undefined);

      await verifyMobileThrowsWhenDeviceNotFound(Platform.ios);
      await verifyMobileThrowsWhenDeviceNotFound(Platform.android);
    });

    it('throws when device fails to boot', async () => {
      $$.SANDBOX.stub(OrgUtils, 'getAppId').resolves(testAppId);
      $$.SANDBOX.stub(PreviewUtils, 'generateWebSocketUrlForLocalDevServer').returns(testServerUrl);
      $$.SANDBOX.stub(PreviewUtils, 'getEntityId').resolves(fakeEntityId);

      $$.SANDBOX.stub(LwcDevMobileCoreSetup.prototype, 'init').resolves();
      $$.SANDBOX.stub(LwcDevMobileCoreSetup.prototype, 'run').resolves();

      $$.SANDBOX.stub(PreviewUtils, 'getMobileDevice').callsFake((platform) =>
        Promise.resolve(platform === Platform.ios ? testIOSDevice : testAndroidDevice)
      );

      await verifyMobileThrowsWhenDeviceFailsToBoot(Platform.ios);
      await verifyMobileThrowsWhenDeviceFailsToBoot(Platform.android);
    });

    it('throws when cannot generate certificate', async () => {
      $$.SANDBOX.stub(OrgUtils, 'getAppId').resolves(testAppId);
      $$.SANDBOX.stub(PreviewUtils, 'generateWebSocketUrlForLocalDevServer').returns(testServerUrl);
      $$.SANDBOX.stub(PreviewUtils, 'getEntityId').resolves(fakeEntityId);

      $$.SANDBOX.stub(LwcDevMobileCoreSetup.prototype, 'init').resolves();
      $$.SANDBOX.stub(LwcDevMobileCoreSetup.prototype, 'run').resolves();

      $$.SANDBOX.stub(PreviewUtils, 'getMobileDevice').callsFake((platform) =>
        Promise.resolve(platform === Platform.ios ? testIOSDevice : testAndroidDevice)
      );

      $$.SANDBOX.stub(AppleDevice.prototype, 'boot').resolves();
      $$.SANDBOX.stub(AndroidDevice.prototype, 'boot').resolves();

      $$.SANDBOX.stub(PreviewUtils, 'generateSelfSignedCert').throws(new Error('Failed to generate certificate'));

      await verifyMobileThrowsWhenFailedToGenerateCert(Platform.ios);
      await verifyMobileThrowsWhenFailedToGenerateCert(Platform.android);
    });

    it('waits for user to manually install the certificate', async () => {
      $$.SANDBOX.stub(OrgUtils, 'getAppId').resolves(testAppId);
      $$.SANDBOX.stub(PreviewUtils, 'generateWebSocketUrlForLocalDevServer').returns(testServerUrl);
      $$.SANDBOX.stub(ConfigUtils, 'getIdentityData').resolves(fakeIdentityData);

      $$.SANDBOX.stub(LwcDevMobileCoreSetup.prototype, 'init').resolves();
      $$.SANDBOX.stub(LwcDevMobileCoreSetup.prototype, 'run').resolves();

      $$.SANDBOX.stub(PreviewUtils, 'getMobileDevice').callsFake((platform) =>
        Promise.resolve(platform === Platform.ios ? testIOSDevice : testAndroidDevice)
      );

      $$.SANDBOX.stub(PreviewUtils, 'generateSelfSignedCert').resolves(certData);

      await verifyMobileWaitsForManualCertInstallation(Platform.ios);
      await verifyMobileWaitsForManualCertInstallation(Platform.android);
    });

    it('throws if user chooses not to install app on mobile device', async () => {
      $$.SANDBOX.stub(OrgUtils, 'getAppId').resolves(testAppId);
      $$.SANDBOX.stub(PreviewUtils, 'generateWebSocketUrlForLocalDevServer').returns(testServerUrl);
      $$.SANDBOX.stub(PreviewUtils, 'getEntityId').resolves(fakeEntityId);

      $$.SANDBOX.stub(LwcDevMobileCoreSetup.prototype, 'init').resolves();
      $$.SANDBOX.stub(LwcDevMobileCoreSetup.prototype, 'run').resolves();

      $$.SANDBOX.stub(PreviewUtils, 'getMobileDevice').callsFake((platform) =>
        Promise.resolve(platform === Platform.ios ? testIOSDevice : testAndroidDevice)
      );

      $$.SANDBOX.stub(PreviewUtils, 'generateSelfSignedCert').resolves(certData);
      $$.SANDBOX.stub(MockedLightningPreviewApp.prototype, 'confirm').resolves(false);

      await verifyMobileThrowsWhenUserDeclinesToInstallApp(Platform.ios);
      await verifyMobileThrowsWhenUserDeclinesToInstallApp(Platform.android);
    });

    it('installs and launches app on mobile device', async () => {
      $$.SANDBOX.stub(OrgUtils, 'getAppId').resolves(testAppId);
      $$.SANDBOX.stub(PreviewUtils, 'generateWebSocketUrlForLocalDevServer').returns(testServerUrl);
      $$.SANDBOX.stub(ConfigUtils, 'getIdentityData').resolves(fakeIdentityData);
      $$.SANDBOX.stub(PreviewUtils, 'getEntityId').resolves(fakeEntityId);

      $$.SANDBOX.stub(LwcDevMobileCoreSetup.prototype, 'init').resolves();
      $$.SANDBOX.stub(LwcDevMobileCoreSetup.prototype, 'run').resolves();

      $$.SANDBOX.stub(PreviewUtils, 'getMobileDevice').callsFake((platform) =>
        Promise.resolve(platform === Platform.ios ? testIOSDevice : testAndroidDevice)
      );

      $$.SANDBOX.stub(PreviewUtils, 'generateSelfSignedCert').resolves(certData);
      $$.SANDBOX.stub(MockedLightningPreviewApp.prototype, 'confirm').resolves(true);

      await verifyAppInstallAndLaunch(Platform.ios);
      await verifyAppInstallAndLaunch(Platform.android);
    });

    async function verifyMobileThrowsWithUnmetRequirements(platform: Platform.ios | Platform.android) {
      try {
        await MockedLightningPreviewApp.run(['-n', 'Sales', '-o', testOrgData.username, '-t', platform]);
      } catch (err) {
        expect(err).to.be.an('error').with.property('message').that.contains('Requirement blah not met');
      }
    }

    async function verifyMobileThrowsWhenDeviceNotFound(platform: Platform.ios | Platform.android) {
      try {
        await MockedLightningPreviewApp.run([
          '-n',
          'Sales',
          '-o',
          testOrgData.username,
          '-t',
          platform,
          '-i',
          'some_device',
        ]);
      } catch (err) {
        expect(err)
          .to.be.an('error')
          .with.property('message', messages.getMessage('error.device.notfound', ['some_device']));
      }
    }

    async function verifyMobileThrowsWhenDeviceFailsToBoot(platform: Platform.ios | Platform.android) {
      const bootStub =
        platform === Platform.ios
          ? $$.SANDBOX.stub(AppleDevice.prototype, 'boot').rejects(new Error('Failed to boot device'))
          : $$.SANDBOX.stub(AndroidDevice.prototype, 'boot').rejects(new Error('Failed to boot device'));

      try {
        await MockedLightningPreviewApp.run(['-n', 'Sales', '-o', testOrgData.username, '-t', platform]);
      } catch (err) {
        expect(err).to.be.an('error').with.property('message', 'Failed to boot device');
        expect(bootStub.called).to.be.true;
      }
    }

    async function verifyMobileThrowsWhenFailedToGenerateCert(platform: Platform.ios | Platform.android) {
      try {
        await MockedLightningPreviewApp.run(['-n', 'Sales', '-o', testOrgData.username, '-t', platform]);
      } catch (err) {
        expect(err).to.be.an('error').with.property('message', 'Failed to generate certificate');
      }
    }

    async function verifyMobileWaitsForManualCertInstallation(platform: Platform.ios | Platform.android) {
      const installCertStub =
        platform === Platform.ios
          ? $$.SANDBOX.stub(AppleDevice.prototype, 'installCert').resolves()
          : $$.SANDBOX.stub(AndroidDevice.prototype, 'installCert').resolves();

      if (platform === Platform.ios) {
        $$.SANDBOX.stub(AppleDevice.prototype, 'boot').resolves();
        $$.SANDBOX.stub(AppleDevice.prototype, 'hasApp').resolves(true);
        $$.SANDBOX.stub(AppleDevice.prototype, 'launchApp').resolves();
      } else {
        $$.SANDBOX.stub(AndroidDevice.prototype, 'boot').resolves();
        $$.SANDBOX.stub(AndroidDevice.prototype, 'hasApp').resolves(true);
        $$.SANDBOX.stub(AndroidDevice.prototype, 'launchApp').resolves();
        $$.SANDBOX.stub(AndroidDevice.prototype, 'isCertInstalled').resolves(false);
      }

      await MockedLightningPreviewApp.run(['-n', 'Sales', '-o', testOrgData.username, '-t', platform]);
      expect(installCertStub.called).to.be.true;
    }

    async function verifyMobileThrowsWhenUserDeclinesToInstallApp(platform: Platform.ios | Platform.android) {
      if (platform === Platform.ios) {
        $$.SANDBOX.stub(AppleDevice.prototype, 'boot').resolves();
        $$.SANDBOX.stub(AppleDevice.prototype, 'installCert').resolves();
        $$.SANDBOX.stub(AppleDevice.prototype, 'hasApp').resolves(false);
      } else {
        $$.SANDBOX.stub(AndroidDevice.prototype, 'boot').resolves();
        $$.SANDBOX.stub(AndroidDevice.prototype, 'installCert').resolves();
        $$.SANDBOX.stub(AndroidDevice.prototype, 'isCertInstalled').resolves(false);
        $$.SANDBOX.stub(AndroidDevice.prototype, 'hasApp').resolves(false);
      }

      const appConfig = platform === Platform.ios ? iOSSalesforceAppPreviewConfig : androidSalesforceAppPreviewConfig;

      try {
        await MockedLightningPreviewApp.run(['-n', 'Sales', '-o', testOrgData.username, '-t', platform]);
      } catch (err) {
        expect(err)
          .to.be.an('error')
          .with.property('message', messages.getMessage('mobileapp.notfound', [appConfig.name]));
      }
    }

    async function verifyAppInstallAndLaunch(platform: Platform.ios | Platform.android) {
      const testBundleArchive = platform === Platform.ios ? '/path/to/bundle.zip' : '/path/to/bundle.apk';
      const expectedOutputDir = path.dirname(testBundleArchive);
      const expectedFinalBundlePath =
        platform === Platform.ios ? path.join(expectedOutputDir, 'Chatter.app') : testBundleArchive;
      const expectedLdpServerUrl = PreviewUtils.generateWebSocketUrlForLocalDevServer(platform, {
        httpPort: 8081,
        httpsPort: 8082,
      });

      const expectedTargetApp =
        platform === Platform.ios
          ? iOSSalesforceAppPreviewConfig.id
          : `${androidSalesforceAppPreviewConfig.id}/${androidSalesforceAppPreviewConfig.activity}`;

      const expectedLaunchArguments = PreviewUtils.generateMobileAppPreviewLaunchArguments(
        expectedLdpServerUrl,
        fakeEntityId,
        'Sales',
        testAppId
      );

      const downloadStub = $$.SANDBOX.stub(PreviewUtils, 'downloadSalesforceMobileAppBundle').resolves(
        testBundleArchive
      );
      const extractStub = $$.SANDBOX.stub(CommonUtils, 'extractZIPArchive').resolves();
      const launchStub =
        platform === Platform.ios
          ? $$.SANDBOX.stub(AppleDevice.prototype, 'launchApp').resolves()
          : $$.SANDBOX.stub(AndroidDevice.prototype, 'launchApp').resolves();

      if (platform === Platform.ios) {
        $$.SANDBOX.stub(AppleDevice.prototype, 'boot').resolves();
        $$.SANDBOX.stub(AppleDevice.prototype, 'installCert').resolves();
        $$.SANDBOX.stub(AppleDevice.prototype, 'hasApp').resolves(false);
      } else {
        $$.SANDBOX.stub(AndroidDevice.prototype, 'boot').resolves();
        $$.SANDBOX.stub(AndroidDevice.prototype, 'installCert').resolves();
        $$.SANDBOX.stub(AndroidDevice.prototype, 'isCertInstalled').resolves(false);
        $$.SANDBOX.stub(AndroidDevice.prototype, 'hasApp').resolves(false);
      }

      await MockedLightningPreviewApp.run(['-n', 'Sales', '-o', testOrgData.username, '-t', platform]);
      expect(downloadStub.calledOnce).to.be.true;

      if (platform === Platform.ios) {
        // on iOS the downloaded bundle is a zip file that needs to be extracted
        expect(extractStub.calledWith(testBundleArchive, expectedOutputDir, sinon.match.any)).to.be.true;
      } else {
        // on Android the downloaded bundle is an APK that doesn't need to be extracted
        expect(extractStub.called).to.be.false;
      }

      expect(launchStub.calledWith(expectedTargetApp, expectedFinalBundlePath, expectedLaunchArguments)).to.be.true;

      downloadStub.restore();
      extractStub.restore();
      launchStub.restore();
    }
  });
});
