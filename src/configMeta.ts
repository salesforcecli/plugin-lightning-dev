/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ConfigValue, ConfigPropertyMeta } from '@salesforce/core';

export enum ConfigVars {
  /**
   * The Base64-encoded identity token of the local web server, used to
   * validate the web server's identity to the hmr-client.
   */
  LOCAL_WEB_SERVER_IDENTITY_TOKEN = 'local-web-server-identity-token',
}

export default [
  {
    key: ConfigVars.LOCAL_WEB_SERVER_IDENTITY_TOKEN,
    description: 'The Base64-encoded identity token of the local web server',
    hidden: true,
    encrypted: true,
    input: {
      validator: (value: ConfigValue): boolean => {
        // Ensure that `value` is a Base64-encoded string.
        if (typeof value !== 'string') {
          return false;
        }
        try {
          const decoded = Buffer.from(value, 'base64').toString('base64');
          return decoded === value;
        } catch (e) {
          return false;
        }
      },
      failedMessage: `${ConfigVars.LOCAL_WEB_SERVER_IDENTITY_TOKEN} is not a Base64-encoded string!`,
    },
  },
] as ConfigPropertyMeta[];
