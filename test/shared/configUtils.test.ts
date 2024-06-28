/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { Workspace } from '@lwc/lwc-dev-server';
import { Config, ConfigAggregator } from '@salesforce/core';
import { TestContext } from '@salesforce/core/testSetup';
import { CryptoUtils } from '@salesforce/lwc-dev-mobile-core';
import {
  ConfigUtils,
  LOCAL_DEV_SERVER_DEFAULT_PORT,
  LOCAL_DEV_SERVER_DEFAULT_WORKSPACE,
} from '../../src/shared/configUtils.js';
import { ConfigVars } from '../../src/configMeta.js';

describe('configUtils', () => {
  const $$ = new TestContext();

  afterEach(() => {
    $$.restore();
  });

  it('getOrCreateIdentityToken resolves if token is found', async () => {
    const fakeIdentityToken = 'fake identity token';
    $$.SANDBOX.stub(ConfigUtils, 'getIdentityToken').resolves(fakeIdentityToken);

    const resolved = await ConfigUtils.getOrCreateIdentityToken();
    expect(resolved).to.equal(fakeIdentityToken);
  });

  it('getOrCreateIdentityToken resolves and writeIdentityToken is called when there is no token', async () => {
    const fakeIdentityToken = 'fake identity token';
    $$.SANDBOX.stub(ConfigUtils, 'getIdentityToken').resolves(undefined);
    $$.SANDBOX.stub(CryptoUtils, 'generateIdentityToken').resolves(fakeIdentityToken);
    const writeIdentityTokenStub = $$.SANDBOX.stub(ConfigUtils, 'writeIdentityToken').resolves();

    const resolved = await ConfigUtils.getOrCreateIdentityToken();
    expect(resolved).to.equal(fakeIdentityToken);
    expect(writeIdentityTokenStub.calledOnce).to.be.true;
  });

  it('getIdentityToken resolves to undefined when identity token is not available', async () => {
    $$.SANDBOX.stub(ConfigAggregator, 'create').resolves(ConfigAggregator.prototype);
    $$.SANDBOX.stub(ConfigAggregator.prototype, 'reload').resolves();
    $$.SANDBOX.stub(ConfigAggregator.prototype, 'getPropertyValue').returns(undefined);
    const resolved = await ConfigUtils.getIdentityToken();

    expect(resolved).to.equal(undefined);
  });

  it('getIdentityToken resolves to a string when identity token is available', async () => {
    const fakeIdentityToken = 'fake identity token';
    $$.SANDBOX.stub(ConfigAggregator, 'create').resolves(ConfigAggregator.prototype);
    $$.SANDBOX.stub(ConfigAggregator.prototype, 'reload').resolves();
    $$.SANDBOX.stub(ConfigAggregator.prototype, 'getPropertyValue').returns(fakeIdentityToken);

    const resolved = await ConfigUtils.getIdentityToken();
    expect(resolved).to.equal(fakeIdentityToken);
  });

  it('writeIdentityToken resolves', async () => {
    const fakeIdentityToken = 'fake identity token';
    $$.SANDBOX.stub(Config, 'create').withArgs($$.SANDBOX.match.any).resolves(Config.prototype);
    $$.SANDBOX.stub(Config, 'addAllowedProperties').withArgs($$.SANDBOX.match.any);
    $$.SANDBOX.stub(Config.prototype, 'set').withArgs(
      ConfigVars.LOCAL_WEB_SERVER_IDENTITY_TOKEN,
      $$.SANDBOX.match.string
    );
    $$.SANDBOX.stub(Config.prototype, 'write').resolves();

    const resolved = await ConfigUtils.writeIdentityToken(fakeIdentityToken);
    expect(resolved).to.equal(undefined);
  });

  it('getCertData resolves to undefined when value not found in config', async () => {
    $$.SANDBOX.stub(Config, 'create').withArgs($$.SANDBOX.match.any).resolves(Config.prototype);
    $$.SANDBOX.stub(Config, 'addAllowedProperties').withArgs($$.SANDBOX.match.any);
    $$.SANDBOX.stub(Config.prototype, 'get').withArgs(ConfigVars.LOCAL_DEV_SERVER_HTTPS_CERT_DATA).returns(undefined);
    const resolved = await ConfigUtils.getCertData();

    expect(resolved).to.equal(undefined);
  });

  it('getCertData resolves to value in config', async () => {
    const certData = {
      derCertificate: 'derCertificate',
      pemCertificate: 'pemCertificate',
      pemPrivateKey: 'pemPrivateKey',
      pemPublicKey: 'pemPublicKey',
    };

    $$.SANDBOX.stub(Config, 'create').withArgs($$.SANDBOX.match.any).resolves(Config.prototype);
    $$.SANDBOX.stub(Config, 'addAllowedProperties').withArgs($$.SANDBOX.match.any);
    $$.SANDBOX.stub(Config.prototype, 'get').withArgs(ConfigVars.LOCAL_DEV_SERVER_HTTPS_CERT_DATA).returns(certData);
    const resolved = await ConfigUtils.getCertData();

    expect(resolved).to.deep.equal(certData);
  });

  it('writeCertData resolves', async () => {
    const certData = {
      derCertificate: Buffer.from('derCertificate', 'utf-8'),
      pemCertificate: 'pemCertificate',
      pemPrivateKey: 'pemPrivateKey',
      pemPublicKey: 'pemPublicKey',
    };

    $$.SANDBOX.stub(Config, 'create').withArgs($$.SANDBOX.match.any).resolves(Config.prototype);
    $$.SANDBOX.stub(Config, 'addAllowedProperties').withArgs($$.SANDBOX.match.any);
    $$.SANDBOX.stub(Config.prototype, 'set').withArgs(ConfigVars.LOCAL_DEV_SERVER_HTTPS_CERT_DATA);
    $$.SANDBOX.stub(Config.prototype, 'write').resolves();

    const resolved = await ConfigUtils.writeCertData(certData);
    expect(resolved).to.equal(undefined);
  });

  it('getLocalDevServerPort resolves to default port when value not found in config', async () => {
    $$.SANDBOX.stub(Config, 'create').withArgs($$.SANDBOX.match.any).resolves(Config.prototype);
    $$.SANDBOX.stub(Config, 'addAllowedProperties').withArgs($$.SANDBOX.match.any);
    $$.SANDBOX.stub(Config.prototype, 'get').withArgs(ConfigVars.LOCAL_DEV_SERVER_PORT).returns(undefined);
    const resolved = await ConfigUtils.getLocalDevServerPort();

    expect(resolved).to.equal(LOCAL_DEV_SERVER_DEFAULT_PORT);
  });

  it('getLocalDevServerPort resolves to port value in config', async () => {
    $$.SANDBOX.stub(Config, 'create').withArgs($$.SANDBOX.match.any).resolves(Config.prototype);
    $$.SANDBOX.stub(Config, 'addAllowedProperties').withArgs($$.SANDBOX.match.any);
    $$.SANDBOX.stub(Config.prototype, 'get').withArgs(ConfigVars.LOCAL_DEV_SERVER_PORT).returns(123);
    const resolved = await ConfigUtils.getLocalDevServerPort();

    expect(resolved).to.equal(123);
  });

  it('getLocalDevServerWorkspace resolves to default workspace when value not found in config', async () => {
    $$.SANDBOX.stub(Config, 'create').withArgs($$.SANDBOX.match.any).resolves(Config.prototype);
    $$.SANDBOX.stub(Config, 'addAllowedProperties').withArgs($$.SANDBOX.match.any);
    $$.SANDBOX.stub(Config.prototype, 'get').withArgs(ConfigVars.LOCAL_DEV_SERVER_WORKSPACE).returns(undefined);
    const resolved = await ConfigUtils.getLocalDevServerWorkspace();

    expect(resolved).to.equal(LOCAL_DEV_SERVER_DEFAULT_WORKSPACE);
  });

  it('getLocalDevServerWorkspace resolves to workspace value in config', async () => {
    $$.SANDBOX.stub(Config, 'create').withArgs($$.SANDBOX.match.any).resolves(Config.prototype);
    $$.SANDBOX.stub(Config, 'addAllowedProperties').withArgs($$.SANDBOX.match.any);
    $$.SANDBOX.stub(Config.prototype, 'get').withArgs(ConfigVars.LOCAL_DEV_SERVER_WORKSPACE).returns(Workspace.SfCli);
    const resolved = await ConfigUtils.getLocalDevServerWorkspace();

    expect(resolved).to.equal(Workspace.SfCli);
  });
});
