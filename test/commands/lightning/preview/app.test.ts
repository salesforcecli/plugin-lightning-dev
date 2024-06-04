/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import { expect } from 'chai';
import { stubSpinner, stubUx } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { PreviewUtils } from '@salesforce/lwc-dev-mobile-core';
import { Config } from '@oclif/core';
import LightningPreviewApp from '../../../../src/commands/lightning/preview/app.js';
import { OrgUtils } from '../../../../src/shared/orgUtils.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);

describe('lightning preview app', () => {
  const messages = Messages.loadMessages('@salesforce/plugin-lightning-dev', 'lightning.preview.app');
  const $$ = new TestContext();
  const testOrgData = new MockTestOrgData();
  const testAppId = '06m8b000002vpFSAAY';
  const testServerUrl = 'wss://localhost:1234';

  beforeEach(async () => {
    stubUx($$.SANDBOX);
    stubSpinner($$.SANDBOX);
    await $$.stubAuths(testOrgData);
  });

  afterEach(() => {
    $$.restore();
  });

  it('throws when app not found', async () => {
    try {
      $$.SANDBOX.stub(OrgUtils, 'getAppId').resolves(undefined);
      await LightningPreviewApp.run(['--name', 'blah', '-o', testOrgData.username]);
    } catch (err) {
      expect(err)
        .to.be.an('error')
        .with.property('message', messages.getMessage('error.fetching.app-id', ['blah']));
    }
  });

  it('throws when cannot determine ldp server url', async () => {
    try {
      $$.SANDBOX.stub(OrgUtils, 'getAppId').resolves(testAppId);
      $$.SANDBOX.stub(PreviewUtils, 'generateWebSocketUrlForLocalDevServer').throws(
        new Error('Cannot determine LDP url.')
      );
      await LightningPreviewApp.run(['--name', 'Sales', '-o', testOrgData.username]);
    } catch (err) {
      expect(err).to.be.an('error').with.property('message', 'Cannot determine LDP url.');
    }
  });

  it('runs org:open with proper flags when app name provided', async () => {
    await verifyOrgOpen(`lightning/app/${testAppId}`, 'Sales');
  });

  it('runs org:open with proper flags when no app name provided', async () => {
    await verifyOrgOpen('lightning');
  });

  async function verifyOrgOpen(expectedAppPath: string, appName: string | undefined = undefined): Promise<void> {
    $$.SANDBOX.stub(OrgUtils, 'getAppId').resolves(testAppId);
    $$.SANDBOX.stub(PreviewUtils, 'generateWebSocketUrlForLocalDevServer').returns(testServerUrl);
    const runCmdStub = $$.SANDBOX.stub(Config.prototype, 'runCommand').resolves();
    if (appName) {
      await LightningPreviewApp.run(['--name', appName, '-o', testOrgData.username]);
    } else {
      await LightningPreviewApp.run(['-o', testOrgData.username]);
    }

    expect(runCmdStub.calledOnce);
    expect(runCmdStub.getCall(0).args).to.deep.equal([
      'org:open',
      [
        '--path',
        `${expectedAppPath}?0.aura.ldpServerUrl=${testServerUrl}&0.aura.mode=DEVPREVIEW`,
        '--target-org',
        testOrgData.username,
      ],
    ]);
  }
});
