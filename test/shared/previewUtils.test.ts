/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { TestContext } from '@salesforce/core/testSetup';
import { expect } from 'chai';
import {
  AndroidDevice,
  AndroidDeviceManager,
  AndroidOSType,
  AppleDevice,
  AppleDeviceManager,
  AppleOSType,
  CommonUtils,
  CryptoUtils,
  DeviceType,
  Platform,
  SSLCertificateData,
  Version,
} from '@salesforce/lwc-dev-mobile-core';
import { Messages } from '@salesforce/core';
import {
  ConfigUtils,
  LOCAL_DEV_SERVER_DEFAULT_HTTP_PORT,
  LocalWebServerIdentityData,
} from '../../src/shared/configUtils.js';
import { PreviewUtils } from '../../src/shared/previewUtils.js';

describe('previewUtils', () => {
  const messages = Messages.loadMessages('@salesforce/plugin-lightning-dev', 'lightning.dev.app');
  const $$ = new TestContext();

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

  const username = 'SalesforceDeveloper';
  const fakeEntityId = '1I9xx0000004ClkCAE';
  const fakeIdentityToken = 'PFT1vw8v65aXd2b9HFvZ3Zu4OcKZwjI60bq7BEjj5k4=';

  afterEach(() => {
    $$.restore();
  });

  it('getNextAvailablePort returns previously saved port', async () => {
    $$.SANDBOX.stub(ConfigUtils, 'getLocalDevServerPorts').resolves({ httpPort: 1111, httpsPort: 1112 });
    const ports = await PreviewUtils.getNextAvailablePorts();
    expect(ports).to.deep.equal({ httpPort: 1111, httpsPort: 1112 });
  });

  it('getNextAvailablePort returns default port when available', async () => {
    $$.SANDBOX.stub(ConfigUtils, 'getLocalDevServerPorts').resolves(undefined);
    $$.SANDBOX.stub(CommonUtils, 'executeCommandSync').returns('');
    const ports = await PreviewUtils.getNextAvailablePorts();
    expect(ports).to.deep.equal({
      httpPort: LOCAL_DEV_SERVER_DEFAULT_HTTP_PORT,
      httpsPort: LOCAL_DEV_SERVER_DEFAULT_HTTP_PORT + 1,
    });
  });

  it('getNextAvailablePort returns next port when default is not available', async () => {
    $$.SANDBOX.stub(ConfigUtils, 'getLocalDevServerPorts').resolves(undefined);
    const mock = $$.SANDBOX.stub(CommonUtils, 'executeCommandSync');
    mock
      .onFirstCall()
      .returns('node    97740 maliroteh   30u  IPv6 0x6edda1e7c018338b      0t0  TCP *:sunproxyadmin (LISTEN)');
    mock.onSecondCall().returns('');
    const ports = await PreviewUtils.getNextAvailablePorts();
    expect(ports).to.deep.equal({
      httpPort: LOCAL_DEV_SERVER_DEFAULT_HTTP_PORT + 2,
      httpsPort: LOCAL_DEV_SERVER_DEFAULT_HTTP_PORT + 3,
    });
  });

  it('getMobileDevice finds device', async () => {
    $$.SANDBOX.stub(AppleDeviceManager.prototype, 'getDevice').resolves(testIOSDevice);
    const iosDevice = await PreviewUtils.getMobileDevice(Platform.ios, testIOSDevice.id);
    expect(iosDevice).to.deep.equal(testIOSDevice);

    $$.SANDBOX.stub(AndroidDeviceManager.prototype, 'getDevice').resolves(testAndroidDevice);
    const androidDevice = await PreviewUtils.getMobileDevice(Platform.android, testAndroidDevice.id);
    expect(androidDevice).to.deep.equal(testAndroidDevice);
  });

  it('getMobileDevice returns first available device', async () => {
    $$.SANDBOX.stub(AppleDeviceManager.prototype, 'enumerateDevices').resolves([testIOSDevice]);
    const iosDevice = await PreviewUtils.getMobileDevice(Platform.ios);
    expect(iosDevice).to.deep.equal(testIOSDevice);

    $$.SANDBOX.stub(AndroidDeviceManager.prototype, 'enumerateDevices').resolves([testAndroidDevice]);
    const androidDevice = await PreviewUtils.getMobileDevice(Platform.android);
    expect(androidDevice).to.deep.equal(testAndroidDevice);
  });

  it('generateDesktopPreviewLaunchArguments', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $$.SANDBOX.stub(PreviewUtils as any, 'getEntityId')
      .withArgs(username)
      .resolves(fakeEntityId);

    expect(
      PreviewUtils.generateDesktopPreviewLaunchArguments(
        'MyLdpServerUrl',
        fakeEntityId,
        'MyAppId',
        'MyTargetOrg',
        'MyAuraMode'
      )
    ).to.deep.equal([
      '--path',
      `lightning/app/MyAppId?0.aura.ldpServerUrl=MyLdpServerUrl&0.aura.ldpServerId=${fakeEntityId}&0.aura.mode=MyAuraMode`,
      '--target-org',
      'MyTargetOrg',
    ]);

    expect(PreviewUtils.generateDesktopPreviewLaunchArguments('MyLdpServerUrl', fakeEntityId)).to.deep.equal([
      '--path',
      `lightning?0.aura.ldpServerUrl=MyLdpServerUrl&0.aura.ldpServerId=${fakeEntityId}&0.aura.mode=DEVPREVIEW`,
    ]);
  });

  it('generateMobileAppPreviewLaunchArguments', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $$.SANDBOX.stub(PreviewUtils as any, 'getEntityId')
      .withArgs(username)
      .resolves(fakeEntityId);

    expect(
      PreviewUtils.generateMobileAppPreviewLaunchArguments(
        'MyLdpServerUrl',
        fakeEntityId,
        'MyAppName',
        'MyAppId',
        'MyAuraMode'
      )
    ).to.deep.equal([
      { name: 'LightningExperienceAppName', value: 'MyAppName' },
      { name: 'LightningExperienceAppID', value: 'MyAppId' },
      { name: 'aura.ldpServerUrl', value: 'MyLdpServerUrl' },
      { name: 'aura.mode', value: 'MyAuraMode' },
      { name: 'aura.ldpServerId', value: fakeEntityId },
    ]);

    expect(PreviewUtils.generateMobileAppPreviewLaunchArguments('MyLdpServerUrl', fakeEntityId)).to.deep.equal([
      { name: 'aura.ldpServerUrl', value: 'MyLdpServerUrl' },
      { name: 'aura.mode', value: 'DEVPREVIEW' },
      { name: 'aura.ldpServerId', value: fakeEntityId },
    ]);
  });

  it('generateSelfSignedCert returns previously saved data', async () => {
    const expectedCertData: SSLCertificateData = {
      derCertificate: Buffer.from(Buffer.from('testDERCert').toString('base64'), 'base64'),
      pemCertificate: 'testPEMCert',
      pemPrivateKey: 'testPrivateKey',
      pemPublicKey: 'testPublicKey',
    };

    $$.SANDBOX.stub(ConfigUtils, 'getCertData').resolves(expectedCertData);
    $$.SANDBOX.stub(CryptoUtils, 'isExpired').returns(false);

    const result = await PreviewUtils.generateSelfSignedCert();

    expect(result.derCertificate.toString('utf8')).to.be.equal('testDERCert');
    expect(result.pemCertificate).to.be.equal('testPEMCert');
    expect(result.pemPrivateKey).to.be.equal('testPrivateKey');
    expect(result.pemPublicKey).to.be.equal('testPublicKey');
  });

  it('getEntityId returns valid entity ID', async () => {
    const identityData: LocalWebServerIdentityData = {
      identityToken: fakeIdentityToken,
      usernameToServerEntityIdMap: {},
    };
    identityData.usernameToServerEntityIdMap[username] = fakeEntityId;
    $$.SANDBOX.stub(ConfigUtils, 'getIdentityData').resolves(identityData);

    const entityId = await PreviewUtils.getEntityId(username);

    expect(entityId).to.equal(fakeEntityId);
  });

  it('getEntityId throws when valid data does not exist', async () => {
    $$.SANDBOX.stub(ConfigUtils, 'getIdentityData').resolves(undefined);

    try {
      await PreviewUtils.getEntityId(username);
    } catch (err) {
      expect(err).to.be.an('error').with.property('message', messages.getMessage('error.identitydata'));
    }
  });

  it('getEntityId throws when entity ID does not exist', async () => {
    const identityData: LocalWebServerIdentityData = {
      identityToken: fakeIdentityToken,
      usernameToServerEntityIdMap: {},
    };
    $$.SANDBOX.stub(ConfigUtils, 'getIdentityData').resolves(identityData);

    try {
      await PreviewUtils.getEntityId(username);
    } catch (err) {
      expect(err).to.be.an('error').with.property('message', messages.getMessage('error.identitydata.entityid'));
    }
  });
});
