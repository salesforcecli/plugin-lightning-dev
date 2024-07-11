/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import fs from 'node:fs';
import path from 'node:path';
import { TestContext } from '@salesforce/core/testSetup';
import { expect } from 'chai';
import {
  AndroidUtils,
  AndroidVirtualDevice,
  CommonUtils,
  IOSSimulatorDevice,
  IOSUtils,
  Platform,
  SSLCertificateData,
} from '@salesforce/lwc-dev-mobile-core';
import { ConfigUtils, LOCAL_DEV_SERVER_DEFAULT_PORT } from '../../src/shared/configUtils.js';
import { PreviewUtils } from '../../src/shared/previewUtils.js';
import {
  iOSSalesforceAppPreviewConfig,
  androidSalesforceAppPreviewConfig,
} from '../../src/commands/lightning/preview/app.js';

describe('previewUtils', () => {
  const $$ = new TestContext();

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

  const username = 'SalesforceDeveloper';
  const entityId = '1I9xx0000004ClkCAE';

  afterEach(() => {
    $$.restore();
  });

  it('getNextAvailablePort returns previously saved port', async () => {
    $$.SANDBOX.stub(ConfigUtils, 'getLocalDevServerPort').resolves(1234);
    const port = await PreviewUtils.getNextAvailablePort();
    expect(port).to.be.equal(1234);
  });

  it('getNextAvailablePort returns default port when available', async () => {
    $$.SANDBOX.stub(ConfigUtils, 'getLocalDevServerPort').resolves(undefined);
    $$.SANDBOX.stub(CommonUtils, 'executeCommandSync').returns('');
    const port = await PreviewUtils.getNextAvailablePort();
    expect(port).to.be.equal(LOCAL_DEV_SERVER_DEFAULT_PORT);
  });

  it('getNextAvailablePort returns next port when default is not available', async () => {
    $$.SANDBOX.stub(ConfigUtils, 'getLocalDevServerPort').resolves(undefined);
    const mock = $$.SANDBOX.stub(CommonUtils, 'executeCommandSync');
    mock
      .onFirstCall()
      .returns('node    97740 maliroteh   30u  IPv6 0x6edda1e7c018338b      0t0  TCP *:sunproxyadmin (LISTEN)');
    mock.onSecondCall().returns('');
    const port = await PreviewUtils.getNextAvailablePort();
    expect(port).to.be.equal(LOCAL_DEV_SERVER_DEFAULT_PORT + 2);
  });

  it('getMobileDevice finds device', async () => {
    $$.SANDBOX.stub(IOSUtils, 'getSimulator').resolves(testIOSDevice);
    const iosDevice = await PreviewUtils.getMobileDevice(Platform.ios, testIOSDevice.udid);
    expect(iosDevice).to.deep.equal(testIOSDevice);

    $$.SANDBOX.stub(AndroidUtils, 'fetchEmulator').resolves(testAndroidDevice);
    const androidDevice = await PreviewUtils.getMobileDevice(Platform.android, testAndroidDevice.name);
    expect(androidDevice).to.deep.equal(testAndroidDevice);
  });

  it('getMobileDevice returns first available device', async () => {
    $$.SANDBOX.stub(IOSUtils, 'getSupportedSimulators').resolves([testIOSDevice]);
    const iosDevice = await PreviewUtils.getMobileDevice(Platform.ios);
    expect(iosDevice).to.deep.equal(testIOSDevice);

    $$.SANDBOX.stub(AndroidUtils, 'fetchEmulators').resolves([testAndroidDevice]);
    const androidDevice = await PreviewUtils.getMobileDevice(Platform.android);
    expect(androidDevice).to.deep.equal(testAndroidDevice);
  });

  it('bootMobileDevice boots device', async () => {
    const bootMock = $$.SANDBOX.stub(IOSUtils, 'bootDevice');
    const launchMock = $$.SANDBOX.stub(IOSUtils, 'launchSimulatorApp');
    let emulatorPort = await PreviewUtils.bootMobileDevice(Platform.ios, testIOSDevice.udid);
    expect(emulatorPort).to.be.undefined; // ios devices won't have an emulator port after booting
    expect(bootMock.calledWith(testIOSDevice.udid, true, undefined)).to.be.true;
    expect(launchMock.callCount).to.be.equal(1);

    const startMock = $$.SANDBOX.stub(AndroidUtils, 'startEmulator').resolves(1234);
    emulatorPort = await PreviewUtils.bootMobileDevice(Platform.android, testAndroidDevice.name);
    expect(emulatorPort).to.be.equal(1234);
    expect(startMock.calledWith(testAndroidDevice.name, false, true, undefined)).to.be.true;
  });

  it('generateDesktopPreviewLaunchArguments', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $$.SANDBOX.stub(PreviewUtils as any, 'getEntityId')
      .withArgs([username])
      .resolves(entityId);

    expect(
      PreviewUtils.generateDesktopPreviewLaunchArguments(
        'MyLdpServerUrl',
        username,
        'MyAppId',
        'MyTargetOrg',
        'MyAuraMode'
      )
    ).to.deep.equal([
      '--path',
      `lightning/app/MyAppId?0.aura.ldpServerUrl=MyLdpServerUrl&0.aura.ldpServerId=${entityId}&0.aura.mode=MyAuraMode`,
      '--target-org',
      'MyTargetOrg',
    ]);

    expect(PreviewUtils.generateDesktopPreviewLaunchArguments('MyLdpServerUrl', username)).to.deep.equal([
      '--path',
      `lightning?0.aura.ldpServerUrl=MyLdpServerUrl&0.aura.ldpServerId=${entityId}&0.aura.mode=DEVPREVIEW`,
    ]);
  });

  it('generateMobileAppPreviewLaunchArguments', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $$.SANDBOX.stub(PreviewUtils as any, 'getEntityId')
      .withArgs([username])
      .resolves(entityId);

    expect(
      PreviewUtils.generateMobileAppPreviewLaunchArguments('MyLdpServerUrl', 'MyAppName', 'MyAppId', 'MyAuraMode')
    ).to.deep.equal([
      { name: 'LightningExperienceAppName', value: 'MyAppName' },
      { name: 'LightningExperienceAppID', value: 'MyAppId' },
      { name: '0.aura.ldpServerUrl', value: 'MyLdpServerUrl' },
      { name: '0.aura.mode', value: 'MyAuraMode' },
    ]);

    expect(PreviewUtils.generateMobileAppPreviewLaunchArguments('MyLdpServerUrl', username)).to.deep.equal([
      { name: '0.aura.ldpServerUrl', value: 'MyLdpServerUrl' },
      { name: '0.aura.mode', value: 'DEVPREVIEW' },
      { name: '0.aura.ldpServerId', value: entityId },
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
    $$.SANDBOX.stub(fs, 'existsSync').returns(false);
    $$.SANDBOX.stub(fs, 'writeFileSync').returns();

    const certDirPath = '/path/to/dir';
    let result = await PreviewUtils.generateSelfSignedCert(Platform.ios, certDirPath);
    expect(result.certFilePath).to.be.equal(path.join(path.resolve(certDirPath), 'localhost.der'));
    expect(result.certData.derCertificate.toString('utf8')).to.be.equal('testDERCert');
    expect(result.certData.pemCertificate).to.be.equal('testPEMCert');
    expect(result.certData.pemPrivateKey).to.be.equal('testPrivateKey');
    expect(result.certData.pemPublicKey).to.be.equal('testPublicKey');

    result = await PreviewUtils.generateSelfSignedCert(Platform.android, certDirPath);
    expect(result.certFilePath).to.be.equal(path.join(path.resolve(certDirPath), 'localhost.pem'));
    expect(result.certData.derCertificate.toString('utf8')).to.be.equal('testDERCert');
    expect(result.certData.pemCertificate).to.be.equal('testPEMCert');
    expect(result.certData.pemPrivateKey).to.be.equal('testPrivateKey');
    expect(result.certData.pemPublicKey).to.be.equal('testPublicKey');
  });

  it('launchMobileApp launches the app', async () => {
    // eslint-disable-next-line camelcase
    iOSSalesforceAppPreviewConfig.launch_arguments = [];
    const iosLaunchMock = $$.SANDBOX.stub(IOSUtils, 'launchAppInBootedSimulator').callsFake(() => Promise.resolve());
    await PreviewUtils.launchMobileApp(Platform.ios, iOSSalesforceAppPreviewConfig, testIOSDevice.udid);
    expect(iosLaunchMock.calledWith(testIOSDevice.udid, undefined, iOSSalesforceAppPreviewConfig.id, [], undefined)).to
      .be.true;

    // eslint-disable-next-line camelcase
    androidSalesforceAppPreviewConfig.launch_arguments = [];
    const androidLaunchMock = $$.SANDBOX.stub(AndroidUtils, 'launchAppInBootedEmulator').callsFake(() =>
      Promise.resolve()
    );
    await PreviewUtils.launchMobileApp(
      Platform.android,
      androidSalesforceAppPreviewConfig,
      testAndroidDevice.deviceName,
      1234
    );
    expect(
      androidLaunchMock.calledWith(
        undefined,
        androidSalesforceAppPreviewConfig.id,
        [],
        androidSalesforceAppPreviewConfig.activity,
        1234,
        undefined
      )
    ).to.be.true;
  });

  it('verifyMobileAppInstalled checks for app on device', async () => {
    $$.SANDBOX.stub(CommonUtils, 'executeCommandSync').returns('some_path');
    expect(await PreviewUtils.verifyMobileAppInstalled(Platform.ios, iOSSalesforceAppPreviewConfig, testIOSDevice.udid))
      .to.be.true;

    $$.SANDBOX.stub(AndroidUtils, 'executeAdbCommand').resolves(undefined);
    expect(
      await PreviewUtils.verifyMobileAppInstalled(
        Platform.android,
        androidSalesforceAppPreviewConfig,
        testAndroidDevice.deviceName,
        1234
      )
    ).to.be.false;
  });
});
