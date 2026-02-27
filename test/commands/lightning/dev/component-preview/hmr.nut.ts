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
/// <reference lib="dom" />
import type { ChildProcessByStdio } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { Readable, Writable } from 'node:stream';
import { TestSession } from '@salesforce/cli-plugins-testkit';
import { expect } from 'chai';
import { type Browser, type Page } from 'playwright';
import { getSession, getComponentPath } from '../helpers/sessionUtils.js';
import { startLightningDevServer, getPreviewURL, killServerProcess } from '../helpers/devServerUtils.js';
import { getPreview } from '../helpers/browserUtils.js';

const COMPONENT_NAME = 'helloWorld';
const INITIAL_GREETING = 'Hello World';
const HMR_GREETING = 'Hello, HMR Test!';
const BLUE = 'rgb(0, 0, 255)';
const RED = 'rgb(255, 0, 0)';

describe('lightning preview hot module reload', () => {
  let session: TestSession;
  let childProcess: ChildProcessByStdio<Writable, Readable, Readable> | undefined;
  let browser: Browser;
  let page: Page;

  before(async () => {
    session = await getSession();
    childProcess = startLightningDevServer(session, { AUTO_ENABLE_LOCAL_DEV: 'true' }, COMPONENT_NAME);
    const previewUrl = await getPreviewURL(childProcess.stdout);
    ({ browser, page } = await getPreview(previewUrl, session));
  });

  after(async () => {
    if (page) await page.close();
    if (browser) await browser.close();
    killServerProcess(childProcess);
  });

  it('should re-render component and hot reload .js changes', async () => {
    // Assert component rendered with expected content
    const greetingLocator = page.getByText(INITIAL_GREETING);
    expect(await greetingLocator.textContent()).to.equal(INITIAL_GREETING);

    // Change the component source code and write it to trigger HMR
    const componentJsPath = path.join(getComponentPath(session, COMPONENT_NAME), `${COMPONENT_NAME}.js`);
    const originalJsContent = await fs.promises.readFile(componentJsPath, 'utf8');
    const modifiedJsContent = originalJsContent.replace(
      `greeting = '${INITIAL_GREETING}';`,
      `greeting = '${HMR_GREETING}';`,
    );
    await fs.promises.writeFile(componentJsPath, modifiedJsContent, 'utf8');

    // Assert component is re-rendered with updated source code.
    const updatedGreetingLocator = page.getByText(HMR_GREETING);
    expect(await updatedGreetingLocator.textContent()).to.equal(HMR_GREETING);

    await fs.promises.writeFile(componentJsPath, originalJsContent, 'utf8');
  });

  it('should re-render component and hot reload .css changes', async () => {
    // Assert initial color
    // Assert initial HTML
    const greeting = page.getByText(INITIAL_GREETING);
    expect(await greeting.textContent()).to.equal(INITIAL_GREETING);
    const initialGreetingColor = await greeting.evaluate((e) => window.getComputedStyle(e).color);
    expect(initialGreetingColor).to.equal(BLUE);

    // Update component .css
    const componentCssPath = path.join(getComponentPath(session, COMPONENT_NAME), `${COMPONENT_NAME}.css`);
    const originalCssContent = await fs.promises.readFile(componentCssPath, 'utf8');
    const modifiedCssContent = originalCssContent.replace(`color: ${BLUE};`, `color: ${RED};`);
    await fs.promises.writeFile(componentCssPath, modifiedCssContent, 'utf8');

    // Assert updated color
    const maxAttempts = 300;
    let attempt = 0;
    let greetingColor;
    while (greetingColor !== RED && attempt < maxAttempts) {
      // eslint-disable-next-line no-await-in-loop
      await page.waitForTimeout(500);
      // eslint-disable-next-line no-await-in-loop
      greetingColor = await greeting.evaluate((e) => window.getComputedStyle(e).color);
      attempt++;
    }
    expect(greetingColor).to.equal(RED);
    await fs.promises.writeFile(componentCssPath, originalCssContent, 'utf8');
  });

  it('should re-render component and hot reload .html changes', async () => {
    // Assert initial HTML
    const greetingLocator = page.getByText(INITIAL_GREETING);
    expect(await greetingLocator.textContent()).to.equal(INITIAL_GREETING);

    // Update HTML template
    const componentHtmlPath = path.join(getComponentPath(session, COMPONENT_NAME), `${COMPONENT_NAME}.html`);
    const originalHtmlContent = await fs.promises.readFile(componentHtmlPath, 'utf8');
    const modifiedHtmlContent = originalHtmlContent.replace(
      '<div class="greeting">{greeting}</div>',
      `<div class="greeting">{greeting}<span>${HMR_GREETING}</span></div>`,
    );
    await fs.promises.writeFile(componentHtmlPath, modifiedHtmlContent, 'utf8');

    // Assert updated HTML
    const hmrMarkerLocator = page.getByText(HMR_GREETING);
    expect(await hmrMarkerLocator.textContent()).to.equal(HMR_GREETING);

    await fs.promises.writeFile(componentHtmlPath, originalHtmlContent, 'utf8');
  });
});
