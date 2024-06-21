/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */

import { expect } from 'chai';
import { Config, ConfigAggregator } from '@salesforce/core';
import { TestContext } from '@salesforce/core/testSetup';
import { CryptoUtils } from '@salesforce/lwc-dev-mobile-core';
import { IdentityUtils } from '../../src/shared/identityUtils.js';
import { ConfigVars } from '../../src/configMeta.js';

describe('identityUtils', () => {
  const $$ = new TestContext();

  afterEach(() => {
    $$.restore();
  });

  it('getOrCreateIdentityToken resolves if token is found', async () => {
    const fakeIdentityToken = 'fake identity token';
    $$.SANDBOX.stub(IdentityUtils, 'getIdentityToken').resolves(fakeIdentityToken);

    const resolved = await IdentityUtils.getOrCreateIdentityToken();
    expect(resolved).to.equal(fakeIdentityToken);
  });

  it('getOrCreateIdentityToken resolves and writeIdentityToken is called when there is no token', async () => {
    const fakeIdentityToken = 'fake identity token';
    $$.SANDBOX.stub(IdentityUtils, 'getIdentityToken').resolves(undefined);
    $$.SANDBOX.stub(CryptoUtils, 'generateIdentityToken').resolves(fakeIdentityToken);
    const writeIdentityTokenStub = $$.SANDBOX.stub(IdentityUtils, 'writeIdentityToken').resolves();

    const resolved = await IdentityUtils.getOrCreateIdentityToken();
    expect(resolved).to.equal(fakeIdentityToken);
    expect(writeIdentityTokenStub.calledOnce).to.be.true;
  });

  it('getIdentityToken resolves to undefined when identity token is not available', async () => {
    $$.SANDBOX.stub(ConfigAggregator, 'create').resolves(ConfigAggregator.prototype);
    $$.SANDBOX.stub(ConfigAggregator.prototype, 'reload').resolves();
    $$.SANDBOX.stub(ConfigAggregator.prototype, 'getPropertyValue').returns(undefined);
    const resolved = await IdentityUtils.getIdentityToken();

    expect(resolved).to.equal(undefined);
  });

  it('getIdentityToken resolves to a string when identity token is available', async () => {
    const fakeIdentityToken = 'fake identity token';
    $$.SANDBOX.stub(ConfigAggregator, 'create').resolves(ConfigAggregator.prototype);
    $$.SANDBOX.stub(ConfigAggregator.prototype, 'reload').resolves();
    $$.SANDBOX.stub(ConfigAggregator.prototype, 'getPropertyValue').returns(fakeIdentityToken);

    const resolved = await IdentityUtils.getIdentityToken();
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

    const resolved = await IdentityUtils.writeIdentityToken(fakeIdentityToken);
    expect(resolved).to.equal(undefined);
  });
});
