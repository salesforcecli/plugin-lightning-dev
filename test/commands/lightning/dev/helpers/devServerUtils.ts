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
