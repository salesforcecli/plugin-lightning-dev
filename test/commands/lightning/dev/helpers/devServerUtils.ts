/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import path from 'node:path';
import { spawn, ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const pluginRoot = path.resolve(currentDir, '../../../../..');

export const startLightningDevServer = (projectDir: string, componentName: string): ChildProcess => {
  const devScriptPath = path.join(pluginRoot, 'bin', 'run.js');

  return spawn('node', [devScriptPath, 'lightning', 'dev', 'component', '--name', componentName], {
    cwd: projectDir,
    env: { ...process.env, NODE_ENV: 'production', PORT: '3000', OPEN_BROWSER: process.env.OPEN_BROWSER ?? 'false' },
  });
};
