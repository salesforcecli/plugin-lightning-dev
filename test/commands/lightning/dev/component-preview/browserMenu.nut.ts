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

const COMPONENT_NAME = 'helloWorld';
const INITIAL_GREETING = 'Hello World';
const STATIC_CONTENT = 'Static Content';

describe('lightning preview menu', () => {
  let session: TestSession;
  let childProcess: ChildProcessByStdio<Writable, Readable, Readable> | undefined;
  let browser: Browser;
  let page: Page;

  beforeEach(async () => {
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

  afterEach(async () => {
    if (page) await page.close();
    if (browser) await browser.close();
    killServerProcess(childProcess);
  });

  it('should render select link and hamburger menu with helloWorld available and clickable', async () => {
    const greetingLocator = page.getByText(INITIAL_GREETING);
    await greetingLocator.waitFor({ state: 'visible' });

    // When a component is already selected (e.g. --name helloWorld), the canvas shows the component,
    // not the "Select a component..." link. Open the hamburger to verify the panel and helloWorld.
    const menuToggle = page.getByRole('link', { name: 'Toggle menu' });
    await menuToggle.waitFor({ state: 'visible' });
    await menuToggle.scrollIntoViewIfNeeded();
    await menuToggle.click({ force: true });

    // Hamburger opens lwr_dev-component-panel (slide-in panel)
    const componentPanel = page.locator('lwr_dev-component-panel >> .lwr-dev-component-panel__panel--visible');
    await componentPanel.waitFor({ state: 'visible' });

    const staticItem = page.locator(
      'lwr_dev-component-panel >> .lwr-dev-component-panel__item[data-specifier="c/static"]',
    );
    await staticItem.waitFor({ state: 'visible' });
    await staticItem.click();

    // Wait for the app to load the selected component (URL updates with specifier)
    await page.waitForURL(/specifier=c%2Fstatic|c\/static/, { timeout: 15_000 });

    const staticContentLocator = page.getByText(STATIC_CONTENT);
    await staticContentLocator.waitFor({ state: 'visible', timeout: 15_000 });
    expect(await staticContentLocator.textContent()).to.include(STATIC_CONTENT);
  });

  it('should render component in performance mode when performance mode button is clicked', async () => {
    const greetingLocator = page.getByText(INITIAL_GREETING);
    await greetingLocator.waitFor({ state: 'visible' });

    const performanceLink = page.locator(
      'lwr_dev-preview-application >> lwr_dev-preview-header >> .lwr-dev-preview-header__performance-mode-link',
    );
    await performanceLink.waitFor({ state: 'visible' });
    await performanceLink.click();

    await page.waitForURL(/mode=performance/);
    expect(page.url()).to.include('mode=performance');

    const header = page.locator(
      'lwr_dev-preview-application >> lwr_dev-preview-header >> .lwr-dev-preview-header__header',
    );
    expect(await header.first().isHidden()).to.be.true;

    const performanceLinkAfter = page.locator(
      'lwr_dev-preview-application >> lwr_dev-preview-header >> .lwr-dev-preview-header__performance-mode-link',
    );
    expect(await performanceLinkAfter.first().isHidden()).to.be.true;

    await greetingLocator.waitFor({ state: 'visible' });
    expect(await greetingLocator.textContent()).to.equal(INITIAL_GREETING);
  });
});
