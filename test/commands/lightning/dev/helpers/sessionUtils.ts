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

// Number of times TestSession will retry scratch org creation before failing. Scratch org
// signup is intermittently flaky (RemoteOrgSignupFailed / C-9999); retrying avoids spurious
// failures in the post-release pipeline. Overridable via TESTKIT_SETUP_RETRIES.
const SETUP_RETRIES = Number.parseInt(process.env.TESTKIT_SETUP_RETRIES ?? '', 10) || 3;

/**
 * Restores process.cwd() if it is currently a leaked sinon stub.
 *
 * TestSession's constructor stubs process.cwd() *before* it creates scratch orgs. If org
 * creation then throws, TestSession.create() rejects without ever returning the instance,
 * so the sandbox is never restored and the stub leaks. The next file's TestSession.create()
 * then throws a misleading "Attempted to wrap cwd which is already wrapped", masking the real
 * error across every subsequent file. Restoring the stub here lets the true failure surface
 * in the one file that actually failed.
 */
function restoreLeakedCwdStub(): void {
  // A sinon stub is self-bound, so calling restore() off the proxy is safe here.
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const cwd = process.cwd as typeof process.cwd & { isSinonProxy?: boolean; restore?: () => void };
  if (cwd.isSinonProxy) {
    cwd.restore?.();
  }
}

/**
 * Returns a shared TestSession for NUTs, created once and reused (same project and Dev Hub).
 *
 * @returns Promise that resolves to the cached or newly created TestSession.
 */
export async function getSession(): Promise<TestSession> {
  if (!cachedSession) {
    try {
      cachedSession = await TestSession.create({
        devhubAuthStrategy: 'AUTO',
        project: { sourceDir: PROJECT_PATH },
        retries: SETUP_RETRIES,
        scratchOrgs: [
          {
            config: 'config/project-scratch-def.json',
            setDefault: true,
          },
        ],
      });
    } catch (err) {
      // Prevent a single setup failure from cascading into misleading errors in later files.
      restoreLeakedCwdStub();
      throw err;
    }
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
