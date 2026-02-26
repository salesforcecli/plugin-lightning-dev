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
import { TestSession } from '@salesforce/cli-plugins-testkit';
import { after } from 'mocha';
import { PLUGIN_ROOT_PATH } from './devServerUtils.js';

let cachedSession: TestSession;

const PROJECT_PATH = path.resolve(PLUGIN_ROOT_PATH, 'test/projects/component-preview-project');

/**
 * Returns a shared TestSession for NUTs, created once and reused (same project and Dev Hub).
 *
 * @returns Promise that resolves to the cached or newly created TestSession.
 */
export async function getSession(): Promise<TestSession> {
  if (!cachedSession) {
    cachedSession = await TestSession.create({
      devhubAuthStrategy: 'AUTO',
      project: { sourceDir: PROJECT_PATH },
      scratchOrgs: [
        {
          config: 'config/project-scratch-def.json',
          setDefault: true,
        },
      ],
    });
  }
  return new Promise((r) => r(cachedSession));
}

/**
 * Returns the filesystem path to an LWC component directory in the test project.
 *
 * @param session - The TestSession (session.project.dir is the project root).
 * @param componentName - LWC name (e.g. 'helloWorld').
 * @returns Absolute path to force-app/main/default/lwc/<componentName>.
 */
export function getComponentPath(session: TestSession, componentName: string) {
  return path.join(session.project?.dir, 'force-app', 'main', 'default', 'lwc', componentName);
}

after(async () => {
  await cachedSession?.clean();
});
