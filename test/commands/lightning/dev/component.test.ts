/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Messages } from '@salesforce/core';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import { stubUx } from '@salesforce/sf-plugins-core';
import { expect } from 'chai';
import LightningDevComponent from '../../../../src/commands/lightning/dev/component.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);

describe('lightning single component preview', () => {
  const messages = Messages.loadMessages('@salesforce/plugin-lightning-dev', 'lightning.dev.component');
  const $$ = new TestContext();
  const testOrgData = new MockTestOrgData();

  beforeEach(async () => {
    stubUx($$.SANDBOX);
    await $$.stubAuths(testOrgData);
  });

  afterEach(() => {
    $$.restore();
  });

  it('should throw error when both client-select and performance flags are used', async () => {
    try {
      await LightningDevComponent.run(['--client-select', '--performance', '--target-org', testOrgData.orgId]);
      expect.fail('Expected command to throw an error');
    } catch (error) {
      expect((error as Error).message).to.equal(messages.getMessage('error.performance-client-select-conflict'));
    }
  });
});
