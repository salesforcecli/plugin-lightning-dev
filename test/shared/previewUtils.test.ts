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

import { parseArgs } from 'node:util';
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
import { AuthInfo, Connection, Logger, Org } from '@salesforce/core';
import { PreviewUtils as LwcDevMobileCorePreviewUtils } from '@salesforce/lwc-dev-mobile-core';
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

  it('generateComponentPreviewLaunchArguments with all parameters', async () => {
    const result = PreviewUtils.generateComponentPreviewLaunchArguments(
      'https://localhost:3333',
      testLdpServerId,
      'myTestComponent',
      'myTargetOrg'
    );

    const parsed = parseArgs({
      args: result,
      options: {
        path: { type: 'string' },
        'target-org': { type: 'string' },
      },
    });

    expect(parsed.values.path).to.include('ldpServerUrl=https://localhost:3333');
    expect(parsed.values.path).to.include(`ldpServerId=${testLdpServerId}`);
    expect(parsed.values.path).to.include('specifier=c/myTestComponent');
    expect(parsed.values['target-org']).to.equal('myTargetOrg');
  });

  it('generateComponentPreviewLaunchArguments without componentName', async () => {
    const result = PreviewUtils.generateComponentPreviewLaunchArguments(
      'https://localhost:3333',
      testLdpServerId,
      undefined,
      'myTargetOrg'
    );

    const parsed = parseArgs({
      args: result,
      options: {
        path: { type: 'string' },
        'target-org': { type: 'string' },
      },
    });

    expect(parsed.values.path).to.include('ldpServerUrl=https://localhost:3333');
    expect(parsed.values.path).to.include(`ldpServerId=${testLdpServerId}`);
    expect(parsed.values.path).to.not.include('specifier=');
    expect(parsed.values['target-org']).to.equal('myTargetOrg');
  });

  it('generateComponentPreviewLaunchArguments without targetOrg', async () => {
    const result = PreviewUtils.generateComponentPreviewLaunchArguments(
      'https://localhost:3333',
      testLdpServerId,
      'myTestComponent'
    );

    const parsed = parseArgs({
      args: result,
      options: {
        path: { type: 'string' },
        'target-org': { type: 'string' },
      },
    });

    expect(parsed.values.path).to.include('ldpServerUrl=https://localhost:3333');
    expect(parsed.values.path).to.include(`ldpServerId=${testLdpServerId}`);
    expect(parsed.values.path).to.include('specifier=c/myTestComponent');
    expect(parsed.values['target-org']).to.be.undefined;
  });

  it('generateComponentPreviewLaunchArguments with only required parameters', async () => {
    const result = PreviewUtils.generateComponentPreviewLaunchArguments('https://localhost:3333', testLdpServerId);

    const parsed = parseArgs({
      args: result,
      options: {
        path: { type: 'string' },
        'target-org': { type: 'string' },
      },
    });

    expect(parsed.values.path).to.include('ldpServerUrl=https://localhost:3333');
    expect(parsed.values.path).to.include(`ldpServerId=${testLdpServerId}`);
    expect(parsed.values.path).to.not.include('specifier=');
    expect(parsed.values['target-org']).to.be.undefined;
  });

  it('generatedComponentPreviewLaunchArguments propertly encodes parameters', async () => {
    const result = PreviewUtils.generateComponentPreviewLaunchArguments('https://localhost:3333', testLdpServerId);

    const parsed = parseArgs({
      args: result,
      options: {
        path: { type: 'string' },
        'target-org': { type: 'string' },
      },
    });

    for (const v in parsed.values) {
      if (v.length === 0) {
        continue;
      }
      expect(decodeURIComponent(v) === decodeURIComponent(decodeURIComponent(v)));
    }
  });

  it('getTargetOrgFromArguments finds -o flag', async () => {
    const args = ['command', '-o', 'myOrg', 'otherArg'];
    const result = PreviewUtils.getTargetOrgFromArguments(args);
    expect(result).to.equal('myOrg');
  });

  it('getTargetOrgFromArguments finds --target-org flag', async () => {
    const args = ['command', '--target-org', 'myOrg', 'otherArg'];
    const result = PreviewUtils.getTargetOrgFromArguments(args);
    expect(result).to.equal('myOrg');
  });

  it('getTargetOrgFromArguments finds --target-org flag case insensitive', async () => {
    const args = ['command', '--TARGET-ORG', 'myOrg', 'otherArg'];
    const result = PreviewUtils.getTargetOrgFromArguments(args);
    expect(result).to.equal('myOrg');
  });

  it('getTargetOrgFromArguments returns undefined when flag not found', async () => {
    const args = ['command', 'otherArg'];
    const result = PreviewUtils.getTargetOrgFromArguments(args);
    expect(result).to.be.undefined;
  });

  it('getTargetOrgFromArguments returns undefined when flag is last argument', async () => {
    const args = ['command', 'otherArg', '--target-org'];
    const result = PreviewUtils.getTargetOrgFromArguments(args);
    expect(result).to.be.undefined;
  });

  it('generateWebSocketUrlForLocalDevServer delegates to core library', async () => {
    const mockUrl = 'ws://localhost:3333';
    const platform = 'iOS';
    const ports = { httpPort: 3333, httpsPort: 3334 };

    const generateWebSocketUrlStub = $$.SANDBOX.stub(
      LwcDevMobileCorePreviewUtils,
      'generateWebSocketUrlForLocalDevServer'
    ).returns(mockUrl);

    const result = PreviewUtils.generateWebSocketUrlForLocalDevServer(platform, ports, {} as Logger);

    expect(result).to.equal(mockUrl);
    expect(generateWebSocketUrlStub.calledOnceWith(platform, ports, {} as Logger)).to.be.true;
  });

  it('initializePreviewConnection succeeds with valid org', async () => {
    const mockOrg = {
      getConnection: () => ({
        getUsername: () => testUsername,
      }),
    } as Org;

    $$.SANDBOX.stub(OrgUtils, 'isLocalDevEnabled').resolves(true);
    $$.SANDBOX.stub(OrgUtils, 'ensureMatchingAPIVersion').returns();
    $$.SANDBOX.stub(PreviewUtils, 'getOrCreateAppServerIdentity').resolves(testIdentityData);

    const result = await PreviewUtils.initializePreviewConnection(mockOrg);

    expect(result.ldpServerId).to.equal(testLdpServerId);
    expect(result.ldpServerToken).to.equal(testLdpServerToken);
    expect(result.connection).to.exist;
  });

  it('initializePreviewConnection rejects when username is not found', async () => {
    const mockOrg = {
      getConnection: () => ({
        getUsername: () => undefined,
      }),
    } as Org;

    try {
      await PreviewUtils.initializePreviewConnection(mockOrg);
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect((error as Error).message).to.include('Org must have a valid user');
    }
  });

  it('initializePreviewConnection rejects when local dev is not enabled', async () => {
    const mockOrg = {
      getConnection: () => ({
        getUsername: () => testUsername,
      }),
    } as Org;

    $$.SANDBOX.stub(OrgUtils, 'isLocalDevEnabled').resolves(false);

    try {
      await PreviewUtils.initializePreviewConnection(mockOrg);
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect((error as Error).message).to.include('Local Dev is not enabled');
    }
  });

  it('initializePreviewConnection rejects when ldpServerId is not found', async () => {
    const mockOrg = {
      getConnection: () => ({
        getUsername: () => testUsername,
      }),
    } as Org;

    const identityDataWithoutEntityId = {
      identityToken: testLdpServerToken,
      usernameToServerEntityIdMap: {},
    };

    $$.SANDBOX.stub(OrgUtils, 'isLocalDevEnabled').resolves(true);
    $$.SANDBOX.stub(OrgUtils, 'ensureMatchingAPIVersion').returns();
    $$.SANDBOX.stub(PreviewUtils, 'getOrCreateAppServerIdentity').resolves(identityDataWithoutEntityId);

    try {
      await PreviewUtils.initializePreviewConnection(mockOrg);
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect((error as Error).message).to.include('entity ID');
    }
  });
});
