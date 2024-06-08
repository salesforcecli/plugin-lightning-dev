/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { TestContext } from '@salesforce/core/testSetup';
import { expect } from 'chai';
import { CommonUtils } from '@salesforce/lwc-dev-mobile-core';
import { DevServerUtils } from '../../src/shared/devServerUtils.js';

describe('devServerUtils', () => {
  const $$ = new TestContext();

  afterEach(() => {
    $$.restore();
  });

  it('getServerConfigFileLocation returns a path joined from current working directory and lwr.config.json', async () => {
    $$.SANDBOX.stub(process, 'cwd').returns('desktop');
    const configFileLocation = DevServerUtils.getServerConfigFileLocation();
    expect(configFileLocation).to.be.equal('desktop/lwr.config.json');
  });

  it('fetchServerConfigFileContent returns an expected object', async () => {
    $$.SANDBOX.stub(DevServerUtils, 'getServerConfigFileLocation').returns('foo');
    $$.SANDBOX.stub(CommonUtils, 'loadJsonFromFile').withArgs('foo').returns({ foo: 'bar' });
    const config = DevServerUtils.fetchServerConfigFileContent();
    expect(config).to.deep.equal({ foo: 'bar' });
  });

  it('writeServerConfigFileContent calls CommonUtils.createTextFile', async () => {
    $$.SANDBOX.stub(DevServerUtils, 'getServerConfigFileLocation').returns('foo');
    const stub = $$.SANDBOX.stub(CommonUtils, 'createTextFile').resolves();
    expect(stub.calledOnce);
  });
});
