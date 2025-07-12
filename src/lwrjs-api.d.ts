/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

declare module '@lwrjs/api' {
  export type SitesLocalDevOptions = {
    [key: string]: unknown;
    sfCLI?: boolean;
    authToken?: string;
    open?: boolean;
    port?: number;
    logLevel?: string;
    mode?: string;
    siteZip?: string;
    siteDir?: string;
  };

  export function expDev(options: SitesLocalDevOptions): Promise<void>;
  export function setupDev(options: SitesLocalDevOptions): Promise<void>;
}
