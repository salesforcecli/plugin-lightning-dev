/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { TestContext } from '@salesforce/core/testSetup';
import { DevServerUtils } from '../../src/shared/devServerUtils.js';
import { IdentityUtils } from '../../src/shared/identityUtils.js';

describe('identityUtils', () => {
  const $$ = new TestContext();

  afterEach(() => {
    $$.restore();
  });

  it('updateServerConfigFileWithIdentityToken resolves if lwr.config.json is not found', async () => {
    $$.SANDBOX.stub(DevServerUtils, 'getServerConfigFileLocation').returns('lwr.config.json');

    const resolved = await IdentityUtils.updateServerConfigFileWithIdentityToken();
    expect(resolved).to.equal(undefined);
  });

  it('updateServerConfigFileWithIdentityToken resolves if lwr.config.json has identity token', async () => {
    $$.SANDBOX.stub(DevServerUtils, 'getServerConfigFileLocation').returns('lwr.config.json');
    $$.SANDBOX.stub(DevServerUtils, 'fetchServerConfigFileContent').returns({ identityToken: 'foo' });

    const resolved = await IdentityUtils.updateServerConfigFileWithIdentityToken();
    expect(resolved).to.equal(undefined);
  });

  it('updateServerConfigFileWithIdentityToken resolves if lwr.config.json has identity token', async () => {
    $$.SANDBOX.stub(DevServerUtils, 'getServerConfigFileLocation').returns('lwr.config.json');
    $$.SANDBOX.stub(DevServerUtils, 'fetchServerConfigFileContent').returns({ identityToken: 'foo' });

    const resolved = await IdentityUtils.updateServerConfigFileWithIdentityToken();
    expect(resolved).to.equal(undefined);
  });

  it('updateServerConfigFileWithIdentityToken resolves if lwr.config.json has no idenity token and creates one', async () => {
    $$.SANDBOX.stub(DevServerUtils, 'getServerConfigFileLocation').returns('lwr.config.json');
    $$.SANDBOX.stub(DevServerUtils, 'fetchServerConfigFileContent').returns({});
    $$.SANDBOX.stub(DevServerUtils, 'writeServerConfigFileContent').resolves();

    const resolved = await IdentityUtils.updateServerConfigFileWithIdentityToken();
    expect(resolved).to.equal(undefined);
  });

  it('updateServerConfigFileWithIdentityToken rejects if identity token can not be written to lwr.config.json', async () => {
    const errorMessage = 'foo bar';
    $$.SANDBOX.stub(DevServerUtils, 'fetchServerConfigFileContent').returns({});
    $$.SANDBOX.stub(DevServerUtils, 'writeServerConfigFileContent').throws(new Error(errorMessage));

    try {
      await IdentityUtils.updateServerConfigFileWithIdentityToken();
    } catch (err) {
      const error = err as Error;
      expect(error.message).to.equal(errorMessage);
    }
  });
});
