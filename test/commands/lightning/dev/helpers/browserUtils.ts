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

import { chromium, type Browser, type Page } from 'playwright';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';

type OrgDisplayUserResult = { accessToken?: string };

/**
 * Returns the access token for frontdoor sid authentication. Required for
 * Playwright testing. Uses testkit execCmd so the correct CLI executable is
 * used on all platforms (e.g. sf on Unix, sf.cmd on Windows).
 *
 * @param session - TestSession with a default scratch org.
 * @returns The session ID string.
 */
export function getAccessToken(session: TestSession): string {
  const scratchOrg = session.orgs.get('default');
  const username = scratchOrg?.username ?? '';
  const projectDir = session.project?.dir ?? '';
  if (!username || !projectDir) {
    throw new Error('Session has no default scratch org username or project dir');
  }
  const result = execCmd<OrgDisplayUserResult>(`org display user -o ${username} --json`, {
    cwd: projectDir,
    cli: 'sf',
    ensureExitCode: 0,
  });
  const accessToken = result.jsonOutput?.result?.accessToken ?? '';
  if (!accessToken) {
    throw new Error(
      `sf org display user result missing accessToken: ${result.shellOutput.stdout} ${result.shellOutput.stderr ?? ''}`,
    );
  }
  return accessToken;
}

/**
 * Establishes a browser session by opening the Salesforce front-door URL with the access token.
 * The server redirects and sets session cookies (sid, sid_Client, etc.), so the LWR preview app
 * accepts the session. No password or form fill required.
 *
 * @param page - Playwright page.
 * @param previewOrigin - Org origin (e.g. from new URL(previewUrl).origin).
 * @param accessToken - Org access token (sid).
 */
async function establishSessionViaFrontDoor(page: Page, previewOrigin: string, accessToken: string): Promise<void> {
  const frontDoorUrl = `${previewOrigin}/secur/frontdoor.jsp?sid=${accessToken}`;
  await page.goto(frontDoorUrl, { waitUntil: 'commit' });
}

/**
 * Launches a headless (or headed, if HEADED env is set) browser, establishes an authenticated
 * session (front-door URL first; falls back to form login if needed), then navigates to the preview URL.
 *
 * @param previewUrl - Full URL of the LWC component preview (e.g. from getPreviewURL).
 * @param session - TestSession with default scratch org.
 * @param options - Optional. Use form login only (skip front-door) by setting useFormLogin: true.
 * @returns Promise resolving to the Playwright browser and page; caller must close them when done.
 */
export async function getPreview(previewUrl: string, session: TestSession): Promise<{ browser: Browser; page: Page }> {
  const accessToken = getAccessToken(session);
  const previewOrigin = new URL(previewUrl).origin;
  const headed = process.env.HEADED === 'true' || process.env.HEADED === '1';
  const browser = await chromium.launch({ headless: !headed });
  const page = await browser.newPage();

  await establishSessionViaFrontDoor(page, previewOrigin, accessToken);
  await page.goto(previewUrl, { waitUntil: 'load' });
  return new Promise((r) => r({ browser, page }));
}
