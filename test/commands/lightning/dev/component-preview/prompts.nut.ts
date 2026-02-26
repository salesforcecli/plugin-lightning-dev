/*
 * Copyright 2026, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import type { ChildProcessByStdio } from 'node:child_process';
import type { Readable, Writable } from 'node:stream';
import { TestSession } from '@salesforce/cli-plugins-testkit';
import { Connection, Messages, Org } from '@salesforce/core';
import { expect } from 'chai';
import { type Browser, type Page } from 'playwright';
import { MetaUtils } from '../../../../../src/shared/metaUtils.js';
import { getSession } from '../helpers/sessionUtils.js';
import {
  startLightningDevServer,
  waitForPrompt,
  waitForProcessExit,
  getPreviewURL,
  killServerProcess,
} from '../helpers/devServerUtils.js';
import { getPreview } from '../helpers/browserUtils.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const sharedMessages = Messages.loadMessages('@salesforce/plugin-lightning-dev', 'shared.utils');
const promptMessages = Messages.loadMessages('@salesforce/plugin-lightning-dev', 'prompts');

const COMPONENT_NAME = 'helloWorld';

describe('lightning preview component prompts', () => {
  let session: TestSession;
  let childProcess: ChildProcessByStdio<Writable, Readable, Readable> | undefined;
  let connection: Connection;
  let browser: Browser;
  let page: Page;

  beforeEach(async () => {
    session = await getSession();
    const org = await Org.create({ aliasOrUsername: session.orgs.get('default')?.username });
    connection = org.getConnection();
    // Unset required org configuration to trigger prompt behavior
    await MetaUtils.setLightningPreviewEnabled(connection, false);
    await MetaUtils.setMyDomainFirstPartyCookieRequirement(connection, true);
  });

  afterEach(async () => {
    if (page) await page.close();
    if (browser) await browser.close();
    killServerProcess(childProcess);
  });

  it('should error out when local dev is not enabled and AUTO_ENABLE_LOCAL_DEV is false', async () => {
    childProcess = startLightningDevServer(session, {
      AUTO_ENABLE_LOCAL_DEV: false,
    });

    const { code, stderr } = await waitForProcessExit(childProcess);
    expect(code).to.not.equal(0);
    expect(stderr).to.include(sharedMessages.getMessage('error.localdev.not.enabled'));
  });

  it('should error out when user answers "n" to enable local dev prompt', async () => {
    childProcess = startLightningDevServer(session);

    // Wait for enable local dev prompt and answer Y to enable local dev
    await waitForPrompt(childProcess, promptMessages.getMessage('component.enable-local-dev'));
    childProcess.stdin?.write('n\n');

    const { code, stderr } = await waitForProcessExit(childProcess);
    expect(code).to.not.equal(0);
    expect(stderr).to.include(sharedMessages.getMessage('error.localdev.not.enabled'));
  });

  it('should enable local dev and disable first party cookies and render page after selecting component when user answers "Y" to enable local dev', async () => {
    childProcess = startLightningDevServer(session);

    // Wait for enable local dev prompt and answer Y to enable local dev
    await waitForPrompt(childProcess, promptMessages.getMessage('component.enable-local-dev'));
    childProcess.stdin?.write('Y\n');

    // Select first component
    await waitForPrompt(childProcess, promptMessages.getMessage('component.select'));
    childProcess.stdin?.write('\n');

    const previewUrl = await getPreviewURL(childProcess.stdout);
    ({ browser, page } = await getPreview(previewUrl, session));

    const greetingLocator = page.getByText('Hello World');
    await greetingLocator.waitFor({ state: 'visible' });
    expect(await greetingLocator.textContent()).to.equal('Hello World');
  });

  it('should render without a prompt and disable first party cookies when AUTO_ENABLE_LOCAL_DEV=true', async () => {
    childProcess = startLightningDevServer(session, { AUTO_ENABLE_LOCAL_DEV: 'true' }, COMPONENT_NAME);

    const previewUrl = await getPreviewURL(childProcess.stdout);
    ({ browser, page } = await getPreview(previewUrl, session));

    const greetingLocator = page.getByText('Hello World');
    await greetingLocator.waitFor({ state: 'visible' });
    expect(await greetingLocator.textContent()).to.equal('Hello World');

    // Command with AUTO_ENABLE_LOCAL_DEV calls ensureFirstPartyCookiesNotRequired, so requirement is disabled
    expect(await MetaUtils.isFirstPartyCookieRequired(connection)).to.be.false;
  });
});
