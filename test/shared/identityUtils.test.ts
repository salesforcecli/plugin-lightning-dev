/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */


import { expect } from 'chai';
import { TestContext } from '@salesforce/core/testSetup';
import { IdentityUtils } from '../../src/shared/identityUtils.js';
import { LightningDevConfig } from '../../src/shared/lightningDevConfig.js';

describe('identityUtils', () => {
  const $$ = new TestContext();

  afterEach(() => {
    $$.restore();
  });

  it('updateConfigWithIdentityToken resolves if token is found', async () => {
    const fakeIdentityToken = 'fake identity token';
    $$.SANDBOX.stub(IdentityUtils, 'getIdentityToken').resolves(fakeIdentityToken);

    const resolved = await IdentityUtils.updateConfigWithIdentityToken();
    expect(resolved).to.equal(undefined);
  });

  it('updateConfigWithIdentityToken resolves and writeIdentityToken is called when there is no token', async () => {
    $$.SANDBOX.stub(IdentityUtils, 'getIdentityToken').resolves(undefined);
    $$.SANDBOX.stub(IdentityUtils, 'writeIdentityToken').resolves();

    const resolved = await IdentityUtils.updateConfigWithIdentityToken();
    expect(resolved).to.equal(undefined);
  });

  it('getIdentityToken resolves to undefined when identity token is not available', async () => {
    $$.SANDBOX.stub(LightningDevConfig.prototype, 'get').returns(undefined);

    const resolved = await IdentityUtils.getIdentityToken();
    expect(resolved).to.equal(undefined);
  });

  it('getIdentityToken resolves to a string when identity token is available', async () => {
    const fakeIdentityToken = 'fake identity token';
    $$.SANDBOX.stub(LightningDevConfig.prototype, 'get').returns(fakeIdentityToken);

    const resolved = await IdentityUtils.getIdentityToken();
    expect(resolved).to.equal(fakeIdentityToken);
  });

  it('writeIdentityToken resolves', async () => {
    const fakeIdentityToken = 'fake identity token';
    $$.SANDBOX.stub(LightningDevConfig.prototype, 'get').returns(fakeIdentityToken);
    $$.SANDBOX.stub(LightningDevConfig.prototype, 'set').returns();
    $$.SANDBOX.stub(LightningDevConfig.prototype, 'writeSync').returns({});

    const resolved = await IdentityUtils.getIdentityToken();
    expect(resolved).to.equal(fakeIdentityToken);
  });
});
