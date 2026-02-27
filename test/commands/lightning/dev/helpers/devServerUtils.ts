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
import { spawn, ChildProcessByStdio, ChildProcessWithoutNullStreams } from 'node:child_process';
import { Readable } from 'node:stream';
import type { Writable } from 'node:stream';
import { type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TestSession } from '@salesforce/cli-plugins-testkit';

const CURRENT_FILE_PATH = fileURLToPath(import.meta.url);
const CURRENT_DIR_PATH = path.dirname(CURRENT_FILE_PATH);
const PREVIEW_URL_REGEX = /(https:\/\/[^\s]*\/lwr\/application\/[^\s]+)/;
const MAX_WAIT_MS = 30_000;

export const PLUGIN_ROOT_PATH = path.resolve(CURRENT_DIR_PATH, '../../../../..');

/**
 * Extracts the first LWR preview URL from process output.
 *
 * @param output - Accumulated stdout/stderr text from the dev server.
 * @returns The preview URL if found, otherwise null.
 */
function parsePreviewUrl(output: string): string | null {
  const match = output.match(PREVIEW_URL_REGEX);
  return match?.[1]?.trim() ?? null;
}

/**
 * Wait for the preview URL to appear on the given stdout stream (e.g. childProcess.stdout).
 * The preview URL is only ever printed to stdout.
 *
 * @param stdout - Readable stream (e.g. from a spawned process).
 * @returns Promise that resolves with the preview URL, or rejects after MAX_WAIT_MS if not found.
 */
export function getPreviewURL(stdout: Readable): Promise<string> {
  return new Promise((resolve, reject) => {
    let output = '';
    const timerId = setTimeout(
      () => reject(new Error(`Preview URL not returned within ${MAX_WAIT_MS / 1000} seconds`)),
      MAX_WAIT_MS,
    );
    stdout?.on('data', (chunk: Buffer) => {
      output += chunk.toString();
      const previewUrl = parsePreviewUrl(output);
      if (previewUrl) {
        clearTimeout(timerId);
        resolve(previewUrl);
      }
    });
  });
}

/**
 * Wait until the given prompt string appears in the process output (stdout or stderr).
 *
 * @param child - Spawned process with piped stdio.
 * @param prompt - Substring that indicates the prompt is shown.
 * @returns Promise that resolves with the combined output collected so far; rejects after MAX_WAIT_MS if prompt not seen.
 */
export function waitForPrompt(
  child: ChildProcessByStdio<Writable, Readable, Readable>,
  prompt: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    let output = '';
    const timerId = setTimeout(() => {
      const err = new Error(
        `Prompt "${prompt.slice(0, 40)}..." not shown within ${MAX_WAIT_MS / 1000} seconds.`,
      ) as Error & { output?: string };
      err.output = output;
      reject(err);
    }, MAX_WAIT_MS);
    const check = (chunk: Buffer | string): void => {
      output += chunk.toString();
      if (output.includes(prompt)) {
        clearTimeout(timerId);
        resolve(output);
      }
    };
    child.stdout?.on('data', check);
    child.stderr?.on('data', check);
  });
}

/**
 * Collect stdout and stderr until the process exits.
 *
 * @param child - Spawned process with piped stdio.
 * @returns Promise that resolves with exit code, signal, stdout, and stderr; rejects after MAX_WAIT_MS if process has not exited.
 */
export function waitForProcessExit(
  child: ChildProcessByStdio<Writable, Readable, Readable>,
): Promise<{ code: number | null; signal: NodeJS.Signals | null; stdout: string; stderr: string }> {
  let stdout = '';
  let stderr = '';

  child.stdout?.on('data', (chunk) => (stdout += chunk));
  child.stderr?.on('data', (chunk) => (stderr += chunk));

  return new Promise((resolve, reject) => {
    const timerId = setTimeout(() => {
      const err = new Error(`Process not exited within ${MAX_WAIT_MS / 1000} seconds.`) as Error & { output?: string };
      reject(err);
    }, MAX_WAIT_MS);

    child.on('close', (code, signal) => {
      clearTimeout(timerId);
      resolve({ code, signal, stdout, stderr });
    });
  });
}

/**
 * Spawns the Lightning dev component server (sf lightning dev component) for NUTs.
 * Sets OPEN_BROWSER=false and LIGHTNING_DEV_PRINT_PREVIEW_URL=true so tests can capture the URL and drive the browser.
 *
 * @param projectDir - Path to the project root (e.g. session.project.dir).
 * @param username - Target org username or alias (passed as -o).
 * @param env - Optional env vars merged into the process environment.
 * @param componentName - Optional component name (--name); if omitted, the CLI may prompt.
 * @returns The spawned child process with piped stdio; use getPreviewURL(stdout) to get the preview URL.
 */
export function startLightningDevServer(
  session: TestSession,
  env = {},
  componentName?: string,
): ChildProcessWithoutNullStreams {
  const scratchOrg = session.orgs.get('default');
  const username = scratchOrg?.username ?? '';
  const projectDir = session.project?.dir ?? '';

  const runJs = path.join(PLUGIN_ROOT_PATH, 'bin', 'run.js');
  const spawnEnv = {
    ...process.env,
    ...env,
    OPEN_BROWSER: 'false',
    LIGHTNING_DEV_PRINT_PREVIEW_URL: 'true',
  };
  const args = [runJs, 'lightning', 'dev', 'component', '-o', username];
  if (componentName) {
    args.push('--name', componentName);
  }
  return spawn('node', args, {
    cwd: projectDir,
    env: spawnEnv,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

/**
 * Terminates the dev server process and ignores ESRCH (process already exited).
 *
 * @param serverProcess - The child process returned from startLightningDevServer, or undefined.
 */
export function killServerProcess(serverProcess: ChildProcess | undefined): void {
  try {
    if (serverProcess?.pid && process.kill(serverProcess.pid, 0)) {
      process.kill(serverProcess.pid, 'SIGKILL');
    }
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code !== 'ESRCH') throw error;
  }
}
