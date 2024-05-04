/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { TestContext } from '@salesforce/core/testSetup';
// import { expect } from 'chai';
// import { stubSfCommandUx } from '@salesforce/sf-plugins-core';
// import LightningPreviewSite from '../../../../src/commands/lightning/preview/site.js';

// TODO fix me once we have a fully working command
describe('lightning preview site', () => {
  const $$ = new TestContext();
  // let sfCommandStubs: ReturnType<typeof stubSfCommandUx>;

  beforeEach(() => {
    // sfCommandStubs = stubSfCommandUx($$.SANDBOX);
  });

  afterEach(() => {
    $$.restore();
  });

  it('runs hello', async () => {
    // await LightningPreviewSite.run([]);
    // const output = sfCommandStubs.log
    //   .getCalls()
    //   .flatMap((c) => c.args)
    //   .join('\n');
    // expect(output).to.include('hello world');
  });

  it('runs hello with --json and no provided name', async () => {
    // const result = await LightningPreviewSite.run([]);
    // expect(result.path).to.equal('/Users/nkruk/git/plugin-lightning-dev/src/commands/lightning/preview/site.ts');
  });

  it('runs hello world --name Astro', async () => {
    // await LightningPreviewSite.run(['--name', 'Astro']);
    // const output = sfCommandStubs.log
    //   .getCalls()
    //   .flatMap((c) => c.args)
    //   .join('\n');
    // expect(output).to.include('hello Astro');
  });
});
