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
import { expect } from 'chai';
import { type Browser, type Page } from 'playwright';
import { getSession } from '../helpers/sessionUtils.js';
import { startLightningDevServer, getPreviewURL, killServerProcess } from '../helpers/devServerUtils.js';
import { getPreview } from '../helpers/browserUtils.js';

const COMPONENT_NAME = 'withError';
const ERROR_MESSAGE = 'Component generated error';

/** Locator for error message text (class from LWR error display / lwr_dev/errorDisplay) */
const errorMessageEl = (p: Page) => p.locator('.error-message-text');

describe('lightning preview component error', () => {
  let session: TestSession;
  let childProcess: ChildProcessByStdio<Writable, Readable, Readable> | undefined;
  let browser: Browser;
  let page: Page;

  before(async () => {
    session = await getSession();
    childProcess = startLightningDevServer(
      session.project?.dir ?? '',
      session.hubOrg.username,
      { AUTO_ENABLE_LOCAL_DEV: 'true' },
      COMPONENT_NAME,
    );
    const previewUrl = await getPreviewURL(childProcess.stdout);
    ({ browser, page } = await getPreview(previewUrl, session.hubOrg.accessToken));
  });

  after(async () => {
    if (page) await page.close();
    if (browser) await browser.close();
    killServerProcess(childProcess);
  });

  it('should render the error component and display the error modal', async () => {
    const message = errorMessageEl(page);
    await message.waitFor({ state: 'visible', timeout: 15_000 });
    expect(await message.textContent()).to.include(ERROR_MESSAGE);
  });

  it('should display the error modal and close it when the dismiss button is clicked', async () => {
    const message = errorMessageEl(page);
    await message.waitFor({ state: 'visible', timeout: 15_000 });

    const dismissButton = page.getByRole('button', { name: /dismiss/i });
    await dismissButton.waitFor({ state: 'visible' });
    await dismissButton.click();

    await message.waitFor({ state: 'hidden', timeout: 10_000 });
    expect(await message.isHidden()).to.be.true;
  });

  it('should copy the error text to the clipboard when copy is clicked', async () => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.reload({ waitUntil: 'load' });

    const message = errorMessageEl(page);
    await message.waitFor({ state: 'visible', timeout: 15_000 });

    const copyButton = page.getByRole('button', { name: /copy/i });
    await copyButton.waitFor({ state: 'visible' });
    await copyButton.click();

    const clipboardText = await page.evaluate('navigator.clipboard.readText()');
    expect(clipboardText).to.include(ERROR_MESSAGE);
  });
});
