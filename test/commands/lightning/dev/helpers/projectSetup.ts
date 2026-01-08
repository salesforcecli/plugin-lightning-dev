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
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);

const TEMPLATE_DIR = path.resolve(currentDir, '../testdata/lwc/helloWorld');
const SCRATCH_DEF_PATH = path.resolve(currentDir, '../testdata/project-definition.json');

let templateCache: { js: string; html: string; meta: string } | null = null;

const loadTemplateContent = async (): Promise<{ js: string; html: string; meta: string }> => {
  if (!templateCache) {
    const [js, html, meta] = await Promise.all([
      fs.promises.readFile(path.join(TEMPLATE_DIR, 'helloWorld.js'), 'utf8'),
      fs.promises.readFile(path.join(TEMPLATE_DIR, 'helloWorld.html'), 'utf8'),
      fs.promises.readFile(path.join(TEMPLATE_DIR, 'helloWorld.js-meta.xml'), 'utf8'),
    ]);
    templateCache = { js, html, meta };
  }
  return templateCache;
};

export const createSfdxProject = async (projectDir: string, customInstanceUrl: string): Promise<void> => {
  const sfdxProject = {
    packageDirectories: [{ path: 'force-app', default: true }],
    name: 'temp-project',
    namespace: '',
    instanceUrl: customInstanceUrl,
    sourceApiVersion: '60.0',
  };

  // Parallel operations: create directories and read scratch def
  const [, scratchDefContent] = await Promise.all([
    Promise.all([
      fs.promises.mkdir(path.join(projectDir, 'force-app', 'main', 'default', 'lwc'), { recursive: true }),
      fs.promises.mkdir(path.join(projectDir, 'config'), { recursive: true }),
    ]),
    fs.promises.readFile(SCRATCH_DEF_PATH, 'utf8'),
  ]);

  await Promise.all([
    fs.promises.writeFile(path.join(projectDir, 'sfdx-project.json'), JSON.stringify(sfdxProject, null, 2)),
    fs.promises.writeFile(path.join(projectDir, 'config', 'project-scratch-def.json'), scratchDefContent),
  ]);
};

export const createLwcComponent = async (projectDir: string, name: string): Promise<void> => {
  const lwcPath = path.join(projectDir, 'force-app', 'main', 'default', 'lwc', name);

  const [, templates] = await Promise.all([fs.promises.mkdir(lwcPath, { recursive: true }), loadTemplateContent()]);

  await Promise.all([
    fs.promises.writeFile(path.join(lwcPath, `${name}.js`), templates.js.replace(/helloWorld/g, name)),
    fs.promises.writeFile(path.join(lwcPath, `${name}.html`), templates.html),
    fs.promises.writeFile(path.join(lwcPath, `${name}.js-meta.xml`), templates.meta),
  ]);
};

export const clearTemplateCache = (): void => {
  templateCache = null;
};
