/*
 * Copyright 2025, Salesforce, Inc.
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

import path from 'node:path';
import fs from 'node:fs';
import { expect } from 'chai';
import { TestSession } from '@salesforce/cli-plugins-testkit';
import axios from 'axios';
import * as dotenv from 'dotenv';
import { chromium, Browser, Page } from 'playwright';
import { toKebabCase } from './helpers/utils.js';
import { createSfdxProject, createLwcComponent } from './helpers/projectSetup.js';
import { startLightningDevServer } from './helpers/devServerUtils.js';

// Load environment variables from .env file
dotenv.config();

const INSTANCE_URL = process.env.TESTKIT_HUB_INSTANCE;
const TEST_TIMEOUT_MS = 60_000;
const STARTUP_DELAY_MS = 5000;
const DEV_SERVER_PORT = 3000;
const HMR_WAIT_MS = 3000; // Time to wait for HMR to apply changes

// Skip this test in CI environment - run only locally
const shouldSkipTest = process.env.CI === 'true' || process.env.CI === '1';

(shouldSkipTest ? describe.skip : describe)('LWC Local Preview Integration', () => {
  let session: TestSession;
  let componentName: string;
  let projectDir: string;

  before(async () => {
    componentName = 'helloWorld';

    session = await TestSession.create({ devhubAuthStrategy: 'JWT' });

    const timestamp = Date.now();
    projectDir = path.join(session.dir, `lwc-project-${timestamp}`);
    fs.mkdirSync(projectDir, { recursive: true });

    await Promise.all([
      createSfdxProject(projectDir, INSTANCE_URL ?? ''),
      createLwcComponent(projectDir, componentName),
    ]);
  });

  after(async () => {
    await session?.clean();
  });

  it('should start lightning dev server and respond to /c-hello-world/ URL', async function () {
    this.timeout(TEST_TIMEOUT_MS);

    let stderrOutput = '';
    let stdoutOutput = '';
    let exitedEarly = false;
    let exitCode: number | null = null;

    const serverProcess = startLightningDevServer(projectDir, componentName);

    serverProcess.stderr?.on('data', (data: Buffer) => {
      stderrOutput += data.toString();
    });

    serverProcess.stdout?.on('data', (data: Buffer) => {
      stdoutOutput += data.toString();
    });

    serverProcess.on('exit', (code: number) => {
      exitedEarly = true;
      exitCode = code;
    });

    serverProcess.on('error', (error) => {
      exitedEarly = true;
      stderrOutput += `Process error: ${String(error)}\n`;
    });

    // Wait for server startup
    await new Promise((r) => setTimeout(r, STARTUP_DELAY_MS));

    // Test the kebab-case component URL with /c- prefix
    const componentKebabName = toKebabCase(componentName);
    const componentUrl = `http://localhost:${DEV_SERVER_PORT}/c-${componentKebabName}/`;
    let componentHttpSuccess = false;

    try {
      const componentResponse = await axios.get(componentUrl, { timeout: 2000 });
      componentHttpSuccess = componentResponse.status === 200;
    } catch (error) {
      const err = error as { message?: string };
      stderrOutput += `Component URL HTTP request failed: ${err.message ?? 'Unknown error'}\n`;
      componentHttpSuccess = false;
    }

    // Launch browser and test HMR
    let browser: Browser | null = null;
    let page: Page | null = null;
    let hmrTestPassed = false;

    try {
      browser = await chromium.launch({ headless: true });
      page = await browser.newPage();

      // Navigate to component URL
      await page.goto(componentUrl, { waitUntil: 'networkidle' });

      // Get initial content - check for the greeting text
      const initialGreeting = await page.locator('h1').textContent();
      expect(initialGreeting).to.include('Hello, World!');

      // Get the component file path
      const componentJsPath = path.join(
        projectDir,
        'force-app',
        'main',
        'default',
        'lwc',
        componentName,
        `${componentName}.js`
      );

      // Read current component file
      const originalJsContent = await fs.promises.readFile(componentJsPath, 'utf8');

      // Modify the component - change greeting text
      const modifiedJsContent = originalJsContent.replace(
        "greeting = 'Hello, World!';",
        "greeting = 'Hello, HMR Test!';"
      );
      await fs.promises.writeFile(componentJsPath, modifiedJsContent);

      // Wait for HMR to detect and apply changes
      await new Promise((r) => setTimeout(r, HMR_WAIT_MS));

      // Wait for the page content to update (HMR should update without full reload)
      try {
        // Wait for the h1 element to contain the new text (HMR should update without full reload)
        // eslint-disable-next-line unicorn/numeric-separators-style
        await page.locator('h1').waitFor({ state: 'visible', timeout: 10000 });

        // Poll for the updated content with retries
        let retries = 20;
        let foundUpdatedContent = false;
        while (retries > 0 && !foundUpdatedContent) {
          // eslint-disable-next-line no-await-in-loop
          const currentGreeting = await page.locator('h1').textContent();
          if (currentGreeting?.includes('Hello, HMR Test!')) {
            foundUpdatedContent = true;
          } else {
            // eslint-disable-next-line no-await-in-loop
            await new Promise((r) => setTimeout(r, 500));
            retries--;
          }
        }

        // Verify the change is reflected
        const updatedGreeting = await page.locator('h1').textContent();
        expect(updatedGreeting).to.include('Hello, HMR Test!');
        expect(foundUpdatedContent, 'HMR did not update the component within the timeout period').to.be.true;
        hmrTestPassed = true;
      } catch (hmrError) {
        stderrOutput += `HMR test failed: ${String(hmrError)}\n`;
        hmrTestPassed = false;
      }

      // Restore original content
      await fs.promises.writeFile(componentJsPath, originalJsContent);
    } catch (browserError) {
      const err = browserError as { message?: string };
      stderrOutput += `Browser automation error: ${err.message ?? 'Unknown error'}\n`;
      hmrTestPassed = false;
    } finally {
      if (page) await page.close();
      if (browser) await browser.close();
    }

    // Clean up
    try {
      if (serverProcess.pid && process.kill(serverProcess.pid, 0)) {
        process.kill(serverProcess.pid, 'SIGKILL');
      }
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code !== 'ESRCH') throw error;
    }

    // Stderr error check
    const criticalPatterns = [
      'FATAL',
      'Cannot find module',
      'ENOENT',
      'Unable to find component',
      'command lightning:dev:component not found',
    ];
    const hasCriticalError = criticalPatterns.some((pattern) => stderrOutput.includes(pattern));

    expect(
      exitedEarly,
      `Dev server exited early with code ${exitCode}. Full stderr: ${stderrOutput}. Full stdout: ${stdoutOutput}`
    ).to.be.false;
    expect(hasCriticalError, `Critical stderr output detected:\n${stderrOutput}`).to.be.false;
    expect(
      componentHttpSuccess,
      `Dev server did not respond with HTTP 200 for component URL. Tried URL: ${componentUrl}`
    ).to.be.true;
    expect(hmrTestPassed, `HMR test failed. Component changes were not hot-swapped. Full stderr: ${stderrOutput}`).to.be
      .true;
  });
});
