/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import path from 'node:path';
import fs from 'node:fs';
import { expect } from 'chai';
import { TestSession } from '@salesforce/cli-plugins-testkit';
import axios from 'axios';
import { toKebabCase } from './helpers/utils.js';
import { createSfdxProject, createLwcComponent } from './helpers/projectSetup.js';
import { startLightningDevServer } from './helpers/devServerUtils.js';

// Note: dotenv not available, using process.env directly

const INSTANCE_URL = process.env.TESTKIT_HUB_INSTANCE;
const TEST_TIMEOUT_MS = 60_000;
const STARTUP_DELAY_MS = 5000;
const DEV_SERVER_PORT = 3000;

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
  });
});
