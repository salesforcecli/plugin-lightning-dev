/*
 * Copyright 2025, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
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
import { AppDefinition, OrgUtils } from '../../../../src/shared/orgUtils.js';
import { PreviewUtils } from '../../../../src/shared/previewUtils.js';
import { ConfigUtils, LocalWebServerIdentityData } from '../../../../src/shared/configUtils.js';
import { PromptUtils } from '../../../../src/shared/promptUtils.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);

describe('lightning dev app', () => {
  const messages = Messages.loadMessages('@salesforce/plugin-lightning-dev', 'lightning.dev.app');
  const sharedMessages = Messages.loadMessages('@salesforce/plugin-lightning-dev', 'shared.utils');
  const $$ = new TestContext();
  const testOrgData = new MockTestOrgData();
  const testAppDefinition: AppDefinition = {
    DeveloperName: 'TestApp',
    DurableId: '06m8b000002vpFSAAY',
    Label: 'Test App',
    Description: 'An app to be used for unit testing',
  };
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

  const testUsername = 'SalesforceDeveloper';
  const testLdpServerId = '1I9xx0000004ClkCAE';
  const testLdpServerToken = 'PFT1vw8v65aXd2b9HFvZ3Zu4OcKZwjI60bq7BEjj5k4=';
  const testIdentityData: LocalWebServerIdentityData = {
    identityToken: testLdpServerToken,
    usernameToServerEntityIdMap: {},
  };
  testIdentityData.usernameToServerEntityIdMap[testUsername] = testLdpServerId;

  beforeEach(async () => {
    stubUx($$.SANDBOX);
    stubSpinner($$.SANDBOX);
    await $$.stubAuths(testOrgData);

    $$.SANDBOX.stub(SfConfig, 'create').withArgs($$.SANDBOX.match.any).resolves(SfConfig.prototype);
    $$.SANDBOX.stub(SfConfig, 'addAllowedProperties').withArgs($$.SANDBOX.match.any);
    $$.SANDBOX.stub(SfConfig.prototype, 'get').returns(undefined);
    $$.SANDBOX.stub(SfConfig.prototype, 'set');
    $$.SANDBOX.stub(SfConfig.prototype, 'write').resolves();
    $$.SANDBOX.stub(Connection.prototype, 'getUsername').returns(testUsername);
    $$.SANDBOX.stub(PreviewUtils, 'getOrCreateAppServerIdentity').resolves(testIdentityData);
    $$.SANDBOX.stub(OrgUtils, 'isLocalDevEnabled').resolves(true);
    $$.SANDBOX.stub(OrgUtils, 'ensureMatchingAPIVersion').returns();

    MockedLightningPreviewApp = await esmock<typeof LightningDevApp>('../../../../src/commands/lightning/dev/app.js', {
      '../../../../src/lwc-dev-server/index.js': {
        startLWCServer: async () => ({ stopServer: () => {} }),
      },
    });
  });

  afterEach(() => {
    $$.restore();
  });

  it('throws when local dev not enabled', async () => {
    try {
      $$.SANDBOX.restore();
      $$.SANDBOX.stub(OrgUtils, 'isLocalDevEnabled').resolves(false);
      await MockedLightningPreviewApp.run(['--name', 'blah', '-o', testOrgData.username, '-t', Platform.desktop]);
    } catch (err) {
      expect(err).to.be.an('error').with.property('message', sharedMessages.getMessage('error.localdev.not.enabled'));
    }
  });

  it('throws when app not found', async () => {
    try {
      $$.SANDBOX.stub(OrgUtils, 'getAppDefinitionDurableId').resolves(undefined);
      await MockedLightningPreviewApp.run(['--name', 'blah', '-o', testOrgData.username, '-t', Platform.desktop]);
    } catch (err) {
      expect(err)
        .to.be.an('error')
        .with.property('message', messages.getMessage('error.fetching.app-id', ['blah']));
    }
  });

  it('throws when username not found', async () => {
    try {
      $$.SANDBOX.restore();
      $$.SANDBOX.stub(OrgUtils, 'getAppDefinitionDurableId').resolves(undefined);
      $$.SANDBOX.stub(Connection.prototype, 'getUsername').returns(undefined);
      await MockedLightningPreviewApp.run(['--name', 'blah', '-o', testOrgData.username, '-t', Platform.desktop]);
    } catch (err) {
      expect(err).to.be.an('error').with.property('message', sharedMessages.getMessage('error.username'));
    }
  });

  it('throws when cannot determine ldp server url', async () => {
    try {
      $$.SANDBOX.stub(OrgUtils, 'getAppDefinitionDurableId').resolves(testAppDefinition.DurableId);
      $$.SANDBOX.stub(PreviewUtils, 'generateWebSocketUrlForLocalDevServer').throws(
        new Error('Cannot determine LDP url.')
      );
      await MockedLightningPreviewApp.run(['--name', 'Sales', '-o', testOrgData.username, '-t', Platform.desktop]);
    } catch (err) {
      expect(err).to.be.an('error').with.property('message', 'Cannot determine LDP url.');
    }
  });

  describe('desktop dev', () => {
    it('prompts user to select platform when not provided', async () => {
      const promptStub = $$.SANDBOX.stub(PromptUtils, 'promptUserToSelectPlatform').resolves(Platform.desktop);
      $$.SANDBOX.stub(PromptUtils, 'promptUserToSelectLightningExperienceApp').resolves(testAppDefinition);
      await verifyOrgOpen(`lightning/app/${testAppDefinition.DurableId}`);
      expect(promptStub.calledOnce);
    });

    it('runs org:open with proper flags when app name provided', async () => {
      await verifyOrgOpen(`lightning/app/${testAppDefinition.DurableId}`, Platform.desktop, 'Sales');
    });

    it('prompts user to select lightning app when not provided', async () => {
      const promptStub = $$.SANDBOX.stub(PromptUtils, 'promptUserToSelectLightningExperienceApp').resolves(
        testAppDefinition
      );
      await verifyOrgOpen(`lightning/app/${testAppDefinition.DurableId}`, Platform.desktop);
      expect(promptStub.calledOnce);
    });

    async function verifyOrgOpen(expectedAppPath: string, deviceType?: Platform, appName?: string): Promise<void> {
      $$.SANDBOX.stub(OrgUtils, 'getAppDefinitionDurableId').resolves(testAppDefinition.DurableId);
      $$.SANDBOX.stub(PreviewUtils, 'generateWebSocketUrlForLocalDevServer').returns(testServerUrl);
      $$.SANDBOX.stub(ConfigUtils, 'getIdentityData').resolves(testIdentityData);

      const runCmdStub = $$.SANDBOX.stub(OclifConfig.prototype, 'runCommand').resolves();
      const flags = ['--target-org', testOrgData.username];

      if (deviceType) {
        flags.push('--device-type', deviceType);
      }

      if (appName) {
        flags.push('--name', appName);
      }

      await MockedLightningPreviewApp.run(flags);

      expect(runCmdStub.calledOnce);
      expect(runCmdStub.getCall(0).args).to.deep.equal([
        'org:open',
        [
          '--path',
          `${expectedAppPath}?0.aura.ldpServerUrl=${testServerUrl}&0.aura.ldpServerId=${testLdpServerId}&0.aura.mode=DEVPREVIEW`,
          '--target-org',
          testOrgData.username,
        ],
      ]);
    }
  });

  describe('mobile dev', () => {
    it('throws when environment setup requirements are not met', async () => {
      $$.SANDBOX.stub(OrgUtils, 'getAppDefinitionDurableId').resolves(testAppDefinition.DurableId);
      $$.SANDBOX.stub(PreviewUtils, 'generateWebSocketUrlForLocalDevServer').returns(testServerUrl);

      $$.SANDBOX.stub(LwcDevMobileCoreSetup.prototype, 'init').resolves();
      $$.SANDBOX.stub(LwcDevMobileCoreSetup.prototype, 'run').rejects(new Error('Requirement blah not met'));

      await verifyMobileThrowsWithUnmetRequirements(Platform.ios);
      await verifyMobileThrowsWithUnmetRequirements(Platform.android);
    });

    it('throws when unable to fetch mobile device', async () => {
      $$.SANDBOX.stub(OrgUtils, 'getAppDefinitionDurableId').resolves(testAppDefinition.DurableId);
      $$.SANDBOX.stub(PreviewUtils, 'generateWebSocketUrlForLocalDevServer').returns(testServerUrl);

      $$.SANDBOX.stub(LwcDevMobileCoreSetup.prototype, 'init').resolves();
      $$.SANDBOX.stub(LwcDevMobileCoreSetup.prototype, 'run').resolves();

      $$.SANDBOX.stub(PreviewUtils, 'getMobileDevice').resolves(undefined);

      await verifyMobileThrowsWhenDeviceNotFound(Platform.ios);
      await verifyMobileThrowsWhenDeviceNotFound(Platform.android);
    });

    it('throws when device fails to boot', async () => {
      $$.SANDBOX.stub(OrgUtils, 'getAppDefinitionDurableId').resolves(testAppDefinition.DurableId);
      $$.SANDBOX.stub(PreviewUtils, 'generateWebSocketUrlForLocalDevServer').returns(testServerUrl);

      $$.SANDBOX.stub(LwcDevMobileCoreSetup.prototype, 'init').resolves();
      $$.SANDBOX.stub(LwcDevMobileCoreSetup.prototype, 'run').resolves();

      $$.SANDBOX.stub(PreviewUtils, 'getMobileDevice').callsFake((platform) =>
        Promise.resolve(platform === Platform.ios ? testIOSDevice : testAndroidDevice)
      );

      await verifyMobileThrowsWhenDeviceFailsToBoot(Platform.ios);
      await verifyMobileThrowsWhenDeviceFailsToBoot(Platform.android);
    });

    it('throws when cannot generate certificate', async () => {
      $$.SANDBOX.stub(OrgUtils, 'getAppDefinitionDurableId').resolves(testAppDefinition.DurableId);
      $$.SANDBOX.stub(PreviewUtils, 'generateWebSocketUrlForLocalDevServer').returns(testServerUrl);

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

    it('throws if user chooses not to install app on mobile device', async () => {
      $$.SANDBOX.stub(OrgUtils, 'getAppDefinitionDurableId').resolves(testAppDefinition.DurableId);
      $$.SANDBOX.stub(PreviewUtils, 'generateWebSocketUrlForLocalDevServer').returns(testServerUrl);

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

    it('prompts user to select mobile device when not provided', async () => {
      $$.SANDBOX.stub(OrgUtils, 'getAppDefinitionDurableId').resolves(testAppDefinition.DurableId);
      $$.SANDBOX.stub(PreviewUtils, 'generateWebSocketUrlForLocalDevServer').returns(testServerUrl);
      $$.SANDBOX.stub(ConfigUtils, 'getIdentityData').resolves(testIdentityData);

      $$.SANDBOX.stub(LwcDevMobileCoreSetup.prototype, 'init').resolves();
      $$.SANDBOX.stub(LwcDevMobileCoreSetup.prototype, 'run').resolves();

      $$.SANDBOX.stub(PreviewUtils, 'generateSelfSignedCert').resolves(certData);
      $$.SANDBOX.stub(MockedLightningPreviewApp.prototype, 'confirm').resolves(true);

      const promptStub = $$.SANDBOX.stub(PromptUtils, 'promptUserToSelectMobileDevice').resolves(testIOSDevice);
      await verifyAppInstallAndLaunch(Platform.ios);
      expect(promptStub.calledOnce);
    });

    it('installs and launches app on mobile device', async () => {
      $$.SANDBOX.stub(OrgUtils, 'getAppDefinitionDurableId').resolves(testAppDefinition.DurableId);
      $$.SANDBOX.stub(PreviewUtils, 'generateWebSocketUrlForLocalDevServer').returns(testServerUrl);
      $$.SANDBOX.stub(ConfigUtils, 'getIdentityData').resolves(testIdentityData);

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

    async function verifyMobileThrowsWhenUserDeclinesToInstallApp(platform: Platform.ios | Platform.android) {
      if (platform === Platform.ios) {
        $$.SANDBOX.stub(AppleDevice.prototype, 'boot').resolves();
        $$.SANDBOX.stub(AppleDevice.prototype, 'installCert').resolves();
        $$.SANDBOX.stub(AppleDevice.prototype, 'isAppInstalled').resolves(false);
      } else {
        $$.SANDBOX.stub(AndroidDevice.prototype, 'boot').resolves();
        $$.SANDBOX.stub(AndroidDevice.prototype, 'installCert').resolves();
        $$.SANDBOX.stub(AndroidDevice.prototype, 'isCertInstalled').resolves(false);
        $$.SANDBOX.stub(AndroidDevice.prototype, 'isAppInstalled').resolves(false);
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
        testLdpServerId,
        'Sales',
        testAppDefinition.DurableId
      );

      const downloadStub = $$.SANDBOX.stub(PreviewUtils, 'downloadSalesforceMobileAppBundle').resolves(
        testBundleArchive
      );
      const extractStub = $$.SANDBOX.stub(CommonUtils, 'extractZIPArchive').resolves();
      const installStub =
        platform === Platform.ios
          ? $$.SANDBOX.stub(AppleDevice.prototype, 'installApp').resolves()
          : $$.SANDBOX.stub(AndroidDevice.prototype, 'installApp').resolves();
      const launchStub =
        platform === Platform.ios
          ? $$.SANDBOX.stub(AppleDevice.prototype, 'launchApp').resolves()
          : $$.SANDBOX.stub(AndroidDevice.prototype, 'launchApp').resolves();

      if (platform === Platform.ios) {
        $$.SANDBOX.stub(AppleDevice.prototype, 'boot').resolves();
        $$.SANDBOX.stub(AppleDevice.prototype, 'installCert').resolves();
        $$.SANDBOX.stub(AppleDevice.prototype, 'isAppInstalled').resolves(false);
      } else {
        $$.SANDBOX.stub(AndroidDevice.prototype, 'boot').resolves();
        $$.SANDBOX.stub(AndroidDevice.prototype, 'isCertInstalled').resolves(false);
        $$.SANDBOX.stub(AndroidDevice.prototype, 'installCert').resolves();
        $$.SANDBOX.stub(AndroidDevice.prototype, 'isAppInstalled').resolves(false);
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

      expect(installStub.calledWith(expectedFinalBundlePath)).to.be.true;
      expect(launchStub.calledWith(expectedTargetApp, expectedLaunchArguments)).to.be.true;

      downloadStub.restore();
      extractStub.restore();
      launchStub.restore();
    }
  });
});
