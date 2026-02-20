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
import { PROJECT_PATH } from './utils.js';

let cachedSession: TestSession;

export async function getSession(): Promise<TestSession> {
  if (!cachedSession) {
    cachedSession = await TestSession.create({
      devhubAuthStrategy: 'AUTO',
      project: { sourceDir: PROJECT_PATH },
    });
  }
  return new Promise((r) => r(cachedSession));
}

export function getComponentPath(session: TestSession, componentName: string) {
  return path.join(session.project?.dir, 'force-app', 'main', 'default', 'lwc', componentName);
}
