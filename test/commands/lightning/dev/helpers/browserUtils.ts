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

export async function getPreview(
  previewUrl: string,
  accessToken: string | undefined,
): Promise<{ browser: Browser; page: Page }> {
  const previewOrigin = new URL(previewUrl).origin;
  let browser: Browser | null = null;
  let page: Page | null = null;
  const headed = process.env.HEADED === 'true' || process.env.HEADED === '1';
  browser = await chromium.launch({ headless: !headed });
  page = await browser.newPage();
  if (accessToken) {
    await page.context().addCookies([
      {
        name: 'sid',
        value: accessToken,
        domain: new URL(previewOrigin).hostname,
        path: '/',
        expires: Math.floor(Date.now() / 1000) + 86_400,
      },
    ]);
  }
  await page.goto(previewUrl, { waitUntil: 'load' });
  return new Promise((r) => r({ browser, page }));
}
