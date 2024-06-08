/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import fs from 'node:fs';
import { expect } from 'chai';
import { TestContext } from '@salesforce/core/testSetup';
import { DevServerUtils } from '../../src/shared/devServerUtils.js';
import { IdentityUtils } from '../../src/shared/identityUtils.js';

describe('identityUtils', () => {
  const $$ = new TestContext();

  afterEach(() => {
    $$.restore();
  });

  it('createIdentityToken resolves if lwr.config.json is not found', async () => {
    $$.SANDBOX.stub(DevServerUtils, 'getServerConfigFileLocation').returns('lwr.config.json');
    $$.SANDBOX.stub(fs, 'existsSync').returns(false);

    const resolved = await IdentityUtils.createIdentityToken();
    expect(resolved).to.equal(undefined);
  });

  it('createIdentityToken resolves if lwr.config.json has identity token', async () => {
    $$.SANDBOX.stub(DevServerUtils, 'getServerConfigFileLocation').returns('lwr.config.json');
    $$.SANDBOX.stub(fs, 'existsSync').returns(true);
    $$.SANDBOX.stub(DevServerUtils, 'fetchServerConfigFileContent').returns({ identityToken: 'foo' });

    const resolved = await IdentityUtils.createIdentityToken();
    expect(resolved).to.equal(undefined);
  });

  it('createIdentityToken resolves if lwr.config.json has identity token', async () => {
    $$.SANDBOX.stub(DevServerUtils, 'getServerConfigFileLocation').returns('lwr.config.json');
    $$.SANDBOX.stub(fs, 'existsSync').returns(true);
    $$.SANDBOX.stub(DevServerUtils, 'fetchServerConfigFileContent').returns({ identityToken: 'foo' });

    const resolved = await IdentityUtils.createIdentityToken();
    expect(resolved).to.equal(undefined);
  });

  it('createIdentityToken resolves if lwr.config.json has no idenity token and creates one', async () => {
    $$.SANDBOX.stub(DevServerUtils, 'getServerConfigFileLocation').returns('lwr.config.json');
    $$.SANDBOX.stub(fs, 'existsSync').returns(true);
    $$.SANDBOX.stub(DevServerUtils, 'fetchServerConfigFileContent').returns({});
    $$.SANDBOX.stub(DevServerUtils, 'writeServerConfigFileContent').resolves();

    const resolved = await IdentityUtils.createIdentityToken();
    expect(resolved).to.equal(undefined);
  });

  it('createIdentityToken rejects if identity token can not be written to lwr.config.json', async () => {
    const errorMessage = 'foo bar';
    $$.SANDBOX.stub(DevServerUtils, 'getServerConfigFileLocation').returns('lwr.config.json');
    $$.SANDBOX.stub(fs, 'existsSync').returns(true);
    $$.SANDBOX.stub(DevServerUtils, 'fetchServerConfigFileContent').returns({});
    $$.SANDBOX.stub(DevServerUtils, 'writeServerConfigFileContent').throws(new Error(errorMessage));

    try {
      await IdentityUtils.createIdentityToken();
    } catch (err) {
      const error = err as Error;
      expect(error.message).to.equal(
        `Error thrown while trying to write identity token to lwr.config.js: ${errorMessage}`
      );
    }
  });
});
