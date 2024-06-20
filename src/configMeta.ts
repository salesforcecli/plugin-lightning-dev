/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ConfigPropertyMeta, ConfigValue } from '@salesforce/core';

export const enum ConfigVars {
  /**
   * The Base64-encoded identity token of the local web server, used to
   * validate the web server's identity to the hmr-client.
   */
  LOCAL_WEB_SERVER_IDENTITY_TOKEN = 'local-web-server-identity-token',

  /**
   * The port number of the local dev server.
   */
  LOCAL_DEV_SERVER_PORT = 'local-dev-server-port',
}

export default [
  {
    key: ConfigVars.LOCAL_WEB_SERVER_IDENTITY_TOKEN,
    description: 'The Base64-encoded identity token of the local web server',
    hidden: true,
    encrypted: true,
  },
  {
    key: ConfigVars.LOCAL_DEV_SERVER_PORT,
    description: 'The port number of the local dev server',
    input: {
      validator: (value: ConfigValue): boolean => {
        // eslint-disable-next-line no-console
        console.log('Validating: ', value, typeof value);
        const parsedPort = parseInt(value as string, 10);

        if (isNaN(parsedPort)) {
          return false;
        }
        if (parsedPort < 1 || parsedPort > 65535) {
          return false;
        }
        return true;
      },
      failedMessage: 'Must be a number between 1 and 65535',
    },
  },
] as ConfigPropertyMeta[];
