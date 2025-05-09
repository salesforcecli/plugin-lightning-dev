/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { strictEqual } from 'node:assert';
import { TestContext } from '@salesforce/core/testSetup';
import { expect } from 'chai';
import { Org } from '@salesforce/core';
import { LocalDevOptions } from '@lwrjs/api';
import LightningDevSite from '../../../../src/commands/lightning/dev/site.js';
import { OrgUtils } from '../../../../src/shared/orgUtils.js';

describe('lightning dev site', () => {
  const $$ = new TestContext();

  beforeEach(() => {
    $$.SANDBOX.stub(OrgUtils, 'isLocalDevEnabled').resolves(true);
    $$.SANDBOX.stub(OrgUtils, 'ensureMatchingAPIVersion').returns();
  });

  afterEach(() => {
    $$.restore();
  });

  it('should have summary, description, and examples defined', () => {
    strictEqual(typeof LightningDevSite.summary, 'string', 'Summary should be a string');
    strictEqual(typeof LightningDevSite.description, 'string', 'Description should be a string');
    strictEqual(typeof LightningDevSite.examples, 'object', 'Examples should be an array');
  });

  it('result should be undefined if local development is not enabled', async () => {
    $$.SANDBOX.restore();
    $$.SANDBOX.stub(OrgUtils, 'isLocalDevEnabled').resolves(false);
    const result = await LightningDevSite.run(['--name', 'Astro', '--target-org', '00Dxx0000001gEH']);
    expect(result).to.be.undefined;
  });

  it('should have valid startupParams', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
    const org = new Org({ id: '00Dxx0000001gEH', connection: {} } as any);
    $$.SANDBOX.stub(Org, 'create').returns(Promise.resolve(org));

    const startupParams: LocalDevOptions = {
      sfCLI: true,
      authToken: 'test-auth-token',
      open: true,
      port: 3000,
      logLevel: 'error',
      mode: 'dev',
      siteZip: 'test-site-zip',
      siteDir: 'test-site-dir',
    };

    $$.SANDBOX.stub(LightningDevSite, 'run').resolves(Promise.resolve(startupParams));
    process.env.SETUP_ONLY = 'true';

    const result = await LightningDevSite.run(['--name', 'Astro', '--target-org', '00Dxx0000001gEH']);
    delete process.env.SETUP_ONLY;

    expect(result).to.deep.equal(startupParams);
  });
});
