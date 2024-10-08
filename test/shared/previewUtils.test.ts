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
import { AuthInfo, Connection } from '@salesforce/core';
import {
  ConfigUtils,
  LOCAL_DEV_SERVER_DEFAULT_HTTP_PORT,
  LocalWebServerIdentityData,
} from '../../src/shared/configUtils.js';
import { PreviewUtils } from '../../src/shared/previewUtils.js';
import { OrgUtils } from '../../src/shared/orgUtils.js';

describe('previewUtils', () => {
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

  const testUsername = 'SalesforceDeveloper';
  const testLdpServerId = '1I9xx0000004ClkCAE';
  const testLdpServerToken = 'PFT1vw8v65aXd2b9HFvZ3Zu4OcKZwjI60bq7BEjj5k4=';

  const testIdentityData: LocalWebServerIdentityData = {
    identityToken: testLdpServerToken,
    usernameToServerEntityIdMap: {},
  };
  testIdentityData.usernameToServerEntityIdMap[testUsername] = testLdpServerId;

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

  it('generateDesktopPreviewLaunchArguments', async () => {
    expect(
      PreviewUtils.generateDesktopPreviewLaunchArguments(
        'MyLdpServerUrl',
        testLdpServerId,
        'MyAppId',
        'MyTargetOrg',
        'MyAuraMode'
      )
    ).to.deep.equal([
      '--path',
      `lightning/app/MyAppId?0.aura.ldpServerUrl=MyLdpServerUrl&0.aura.ldpServerId=${testLdpServerId}&0.aura.mode=MyAuraMode`,
      '--target-org',
      'MyTargetOrg',
    ]);

    expect(PreviewUtils.generateDesktopPreviewLaunchArguments('MyLdpServerUrl', testLdpServerId)).to.deep.equal([
      '--path',
      `lightning?0.aura.ldpServerUrl=MyLdpServerUrl&0.aura.ldpServerId=${testLdpServerId}&0.aura.mode=DEVPREVIEW`,
    ]);
  });

  it('generateMobileAppPreviewLaunchArguments', async () => {
    expect(
      PreviewUtils.generateMobileAppPreviewLaunchArguments(
        'MyLdpServerUrl',
        testLdpServerId,
        'MyAppName',
        'MyAppId',
        'MyAuraMode'
      )
    ).to.deep.equal([
      { name: 'LightningExperienceAppName', value: 'MyAppName' },
      { name: 'LightningExperienceAppID', value: 'MyAppId' },
      { name: 'aura.ldpServerUrl', value: 'MyLdpServerUrl' },
      { name: 'aura.mode', value: 'MyAuraMode' },
      { name: 'aura.ldpServerId', value: testLdpServerId },
    ]);

    expect(PreviewUtils.generateMobileAppPreviewLaunchArguments('MyLdpServerUrl', testLdpServerId)).to.deep.equal([
      { name: 'aura.ldpServerUrl', value: 'MyLdpServerUrl' },
      { name: 'aura.mode', value: 'DEVPREVIEW' },
      { name: 'aura.ldpServerId', value: testLdpServerId },
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

  it('getOrCreateAppServerIdentity resolves if identity data is found', async () => {
    $$.SANDBOX.stub(Connection.prototype, 'getUsername').returns(testUsername);
    $$.SANDBOX.stub(ConfigUtils, 'getIdentityData').resolves(testIdentityData);

    const resolved = await PreviewUtils.getOrCreateAppServerIdentity(new Connection({ authInfo: new AuthInfo() }));
    expect(resolved).to.deep.equal(testIdentityData);
  });

  it('getOrCreateAppServerIdentity resolves and writeIdentityData is called when there is no identity data', async () => {
    $$.SANDBOX.stub(Connection.prototype, 'getUsername').returns(testUsername);
    $$.SANDBOX.stub(ConfigUtils, 'getIdentityData').resolves(undefined);
    $$.SANDBOX.stub(CryptoUtils, 'generateIdentityToken').returns(testLdpServerToken);
    $$.SANDBOX.stub(OrgUtils, 'saveAppServerIdentityToken').resolves(testLdpServerId);
    const writeIdentityTokenStub = $$.SANDBOX.stub(ConfigUtils, 'writeIdentityData').resolves();

    const resolved = await PreviewUtils.getOrCreateAppServerIdentity(new Connection({ authInfo: new AuthInfo() }));

    expect(resolved).to.deep.equal(testIdentityData);
    expect(writeIdentityTokenStub.calledOnce).to.be.true;
  });
});
