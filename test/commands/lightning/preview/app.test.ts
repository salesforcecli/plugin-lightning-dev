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
  AndroidVirtualDevice,
  IOSSimulatorDevice,
  Setup as LwcDevMobileCoreSetup,
  Platform,
} from '@salesforce/lwc-dev-mobile-core';
import { stubSpinner, stubUx } from '@salesforce/sf-plugins-core';
import { expect } from 'chai';
import esmock from 'esmock';
import sinon from 'sinon';
import LightningPreviewApp, {
  androidSalesforceAppPreviewConfig,
  iOSSalesforceAppPreviewConfig,
} from '../../../../src/commands/lightning/preview/app.js';
import { OrgUtils } from '../../../../src/shared/orgUtils.js';
import { PreviewUtils } from '../../../../src/shared/previewUtils.js';
import { ConfigUtils, LocalWebServerIdentityData } from '../../../../src/shared/configUtils.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);

describe('lightning preview app', () => {
  const messages = Messages.loadMessages('@salesforce/plugin-lightning-dev', 'lightning.preview.app');
  const $$ = new TestContext();
  const testOrgData = new MockTestOrgData();
  const testAppId = '06m8b000002vpFSAAY';
  const testServerUrl = 'wss://localhost:1234';
  const testIOSDevice = new IOSSimulatorDevice(
    'iPhone 15 Pro Max',
    'F2B4097F-F33E-4D8A-8FFF-CE49F8D6C166',
    'Shutdown',
    'iOS 17.4',
    true
  );
  const testAndroidDevice = new AndroidVirtualDevice(
    'Pixel_5_API_34',
    'Pixel 5',
    'myDevice.avd',
    'Google APIs',
    'Android 14.0',
    '34'
  );
  const testEmulatorPort = 1234;
  let MockedLightningPreviewApp: typeof LightningPreviewApp;

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

    MockedLightningPreviewApp = await esmock<typeof LightningPreviewApp>(
      '../../../../src/commands/lightning/preview/app.js',
      {
        '../../../../src/lwc-dev-server/index.js': {
          startLWCServer: async () => ({ stopServer: () => {} }),
        },
      }
    );
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

  describe('desktop preview', () => {
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

  describe('mobile preview', () => {
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

      const bootStub = $$.SANDBOX.stub(PreviewUtils, 'bootMobileDevice').rejects(new Error('Failed to boot device'));

      await verifyMobileThrowsWhenDeviceFailsToBoot(Platform.ios, bootStub);
      await verifyMobileThrowsWhenDeviceFailsToBoot(Platform.android, bootStub);
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

      $$.SANDBOX.stub(PreviewUtils, 'bootMobileDevice').resolves(testEmulatorPort);

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

      $$.SANDBOX.stub(PreviewUtils, 'bootMobileDevice').resolves(testEmulatorPort);

      const expectedCert = {
        certData: {
          derCertificate: Buffer.from('A', 'utf-8'),
          pemCertificate: 'B',
          pemPrivateKey: 'C',
          pemPublicKey: 'D',
        },
        certFilePath: '/path/to/localhost.pem',
      };
      $$.SANDBOX.stub(PreviewUtils, 'generateSelfSignedCert').resolves(expectedCert);

      const waitForUserToInstallCertStub = $$.SANDBOX.stub(
        MockedLightningPreviewApp.prototype,
        'waitForUserToInstallCert'
      ).resolves();

      $$.SANDBOX.stub(PreviewUtils, 'verifyMobileAppInstalled').resolves(true);
      $$.SANDBOX.stub(PreviewUtils, 'launchMobileApp').resolves();

      await verifyMobileWaitsForManualCertInstallation(
        Platform.ios,
        expectedCert.certFilePath,
        waitForUserToInstallCertStub
      );
      await verifyMobileWaitsForManualCertInstallation(
        Platform.android,
        expectedCert.certFilePath,
        waitForUserToInstallCertStub
      );
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

      $$.SANDBOX.stub(PreviewUtils, 'bootMobileDevice').resolves(testEmulatorPort);

      $$.SANDBOX.stub(PreviewUtils, 'generateSelfSignedCert').resolves({
        certData: {
          derCertificate: Buffer.from('A', 'utf-8'),
          pemCertificate: 'B',
          pemPrivateKey: 'C',
          pemPublicKey: 'D',
        },
        certFilePath: '/path/to/localhost.pem',
      });

      $$.SANDBOX.stub(MockedLightningPreviewApp.prototype, 'waitForUserToInstallCert').resolves();

      const verifyMobileAppInstalledStub = $$.SANDBOX.stub(PreviewUtils, 'verifyMobileAppInstalled').resolves(false);
      $$.SANDBOX.stub(MockedLightningPreviewApp.prototype, 'confirm').resolves(false);

      await verifyMobileThrowsWhenUserDeclinesToInstallApp(Platform.ios, verifyMobileAppInstalledStub);
      await verifyMobileThrowsWhenUserDeclinesToInstallApp(Platform.android, verifyMobileAppInstalledStub);
    });

    it('installs and launched app on mobile device', async () => {
      $$.SANDBOX.stub(OrgUtils, 'getAppId').resolves(testAppId);
      $$.SANDBOX.stub(PreviewUtils, 'generateWebSocketUrlForLocalDevServer').returns(testServerUrl);
      $$.SANDBOX.stub(ConfigUtils, 'getIdentityData').resolves(fakeIdentityData);
      $$.SANDBOX.stub(PreviewUtils, 'getEntityId').resolves(fakeEntityId);

      $$.SANDBOX.stub(LwcDevMobileCoreSetup.prototype, 'init').resolves();
      $$.SANDBOX.stub(LwcDevMobileCoreSetup.prototype, 'run').resolves();

      $$.SANDBOX.stub(PreviewUtils, 'getMobileDevice').callsFake((platform) =>
        Promise.resolve(platform === Platform.ios ? testIOSDevice : testAndroidDevice)
      );

      $$.SANDBOX.stub(PreviewUtils, 'bootMobileDevice').resolves(testEmulatorPort);

      $$.SANDBOX.stub(PreviewUtils, 'generateSelfSignedCert').resolves({
        certData: {
          derCertificate: Buffer.from('A', 'utf-8'),
          pemCertificate: 'B',
          pemPrivateKey: 'C',
          pemPublicKey: 'D',
        },
        certFilePath: '/path/to/localhost.pem',
      });

      $$.SANDBOX.stub(MockedLightningPreviewApp.prototype, 'waitForUserToInstallCert').resolves();

      $$.SANDBOX.stub(PreviewUtils, 'verifyMobileAppInstalled').resolves(false);
      $$.SANDBOX.stub(MockedLightningPreviewApp.prototype, 'confirm').resolves(true);

      const iosBundlePath = '/path/to/bundle.zip';
      const androidBundlePath = '/path/to/bundle.apk';
      const downloadStub = $$.SANDBOX.stub(PreviewUtils, 'downloadSalesforceMobileAppBundle').callsFake((platform) =>
        Promise.resolve(platform === Platform.ios ? iosBundlePath : androidBundlePath)
      );
      const extractStub = $$.SANDBOX.stub(PreviewUtils, 'extractZIPArchive').resolves();
      const launchStub = $$.SANDBOX.stub(PreviewUtils, 'launchMobileApp').resolves();

      await verifyAppInstallAndLaunch(Platform.ios, iosBundlePath, downloadStub, extractStub, launchStub);
      await verifyAppInstallAndLaunch(Platform.android, androidBundlePath, downloadStub, extractStub, launchStub);
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

    async function verifyMobileThrowsWhenDeviceFailsToBoot(
      platform: Platform.ios | Platform.android,
      bootStub: sinon.SinonStub
    ) {
      try {
        await MockedLightningPreviewApp.run(['-n', 'Sales', '-o', testOrgData.username, '-t', platform]);
      } catch (err) {
        expect(err).to.be.an('error').with.property('message', 'Failed to boot device');

        expect(
          bootStub.calledWith(
            platform,
            platform === Platform.ios ? testIOSDevice.udid : testAndroidDevice.name,
            sinon.match.any
          )
        ).to.be.true;
      } finally {
        bootStub.resetHistory();
      }
    }

    async function verifyMobileThrowsWhenFailedToGenerateCert(platform: Platform.ios | Platform.android) {
      try {
        await MockedLightningPreviewApp.run(['-n', 'Sales', '-o', testOrgData.username, '-t', platform]);
      } catch (err) {
        expect(err).to.be.an('error').with.property('message', 'Failed to generate certificate');
      }
    }

    async function verifyMobileWaitsForManualCertInstallation(
      platform: Platform.ios | Platform.android,
      expectedCertFilePath: string,
      waitForUserToInstallCertStub: sinon.SinonStub
    ) {
      const expectedDevice = platform === Platform.ios ? testIOSDevice : testAndroidDevice;
      await MockedLightningPreviewApp.run(['-n', 'Sales', '-o', testOrgData.username, '-t', platform]);
      expect(waitForUserToInstallCertStub.calledWith(platform, expectedDevice, expectedCertFilePath)).to.be.true;
      waitForUserToInstallCertStub.resetHistory();
    }

    async function verifyMobileThrowsWhenUserDeclinesToInstallApp(
      platform: Platform.ios | Platform.android,
      verifyMobileAppInstalledStub: sinon.SinonStub
    ) {
      const appConfig = platform === Platform.ios ? iOSSalesforceAppPreviewConfig : androidSalesforceAppPreviewConfig;
      const deviceId = platform === Platform.ios ? testIOSDevice.udid : testAndroidDevice.name;

      try {
        await MockedLightningPreviewApp.run(['-n', 'Sales', '-o', testOrgData.username, '-t', platform]);
      } catch (err) {
        expect(err)
          .to.be.an('error')
          .with.property('message', messages.getMessage('mobileapp.notfound', [appConfig.name]));

        expect(
          verifyMobileAppInstalledStub.calledWith(platform, appConfig, deviceId, testEmulatorPort, sinon.match.any)
        ).to.be.true;
      } finally {
        verifyMobileAppInstalledStub.resetHistory();
      }
    }

    async function verifyAppInstallAndLaunch(
      platform: Platform.ios | Platform.android,
      testBundleArchive: string,
      downloadStub: sinon.SinonStub,
      extractStub: sinon.SinonStub,
      launchStub: sinon.SinonStub
    ) {
      const expectedOutputDir = path.dirname(testBundleArchive);
      const expectedFinalBundlePath =
        platform === Platform.ios ? path.join(expectedOutputDir, 'Chatter.app') : testBundleArchive;
      const expectedLdpServerUrl = PreviewUtils.generateWebSocketUrlForLocalDevServer(platform, {
        httpPort: 8081,
        httpsPort: 8082,
      });
      const expectedDeviceId = platform === Platform.ios ? testIOSDevice.udid : testAndroidDevice.name;
      const expectedAppConfig =
        platform === Platform.ios ? iOSSalesforceAppPreviewConfig : androidSalesforceAppPreviewConfig;
      // eslint-disable-next-line camelcase
      expectedAppConfig.launch_arguments = PreviewUtils.generateMobileAppPreviewLaunchArguments(
        expectedLdpServerUrl,
        fakeEntityId,
        'Sales',
        testAppId
      );

      await MockedLightningPreviewApp.run(['-n', 'Sales', '-o', testOrgData.username, '-t', platform]);
      expect(downloadStub.calledOnce).to.be.true;

      if (platform === Platform.ios) {
        // on iOS the downloaded bundle is a zip file that needs to be extracted
        expect(extractStub.calledWith(testBundleArchive, expectedOutputDir, sinon.match.any)).to.be.true;
      } else {
        // on ANdroid the downloaded bundle is an APK that doesn't need to be extracted
        expect(extractStub.called).to.be.false;
      }

      expect(
        launchStub.calledWith(
          platform,
          expectedAppConfig,
          expectedDeviceId,
          testEmulatorPort,
          expectedFinalBundlePath,
          sinon.match.any
        )
      ).to.be.true;

      downloadStub.resetHistory();
      extractStub.resetHistory();
      launchStub.resetHistory();
    }
  });
});
