/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ConfigPropertyMeta, ConfigValue } from '@salesforce/core';
import { Workspace } from '@lwc/lwc-dev-server';
import { Messages } from '@salesforce/core';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-lightning-dev', 'shared.utils');
const LOCAL_DEV_SERVER_PORT_MESSAGE = messages.getMessage('lwc-dev-server-utils.port-message');
const LOCAL_DEV_SERVER_WORKSPACE_MESSAGE = messages.getMessage('lwc-dev-server-utils.workspace-message');

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

  /**
   * The Workspace name of the local dev server.
   */
  LOCAL_DEV_SERVER_WORKSPACE = 'local-dev-server-workspace',
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
        if (!value) {
          return false;
        }

        const parsedPort = parseInt(value as string, 10);

        if (isNaN(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
          return false;
        }
        return true;
      },
      failedMessage: LOCAL_DEV_SERVER_PORT_MESSAGE,
    },
  },
  {
    key: ConfigVars.LOCAL_DEV_SERVER_WORKSPACE,
    description: 'The workspace name of the local dev server',
    input: {
      validator: (value: ConfigValue): boolean => {
        if (!value) {
          return false;
        }

        const workspace = value as Workspace;

        if (workspace === Workspace.SfCli || workspace === Workspace.Mrt) {
          return true;
        }
        return false;
      },
      failedMessage: LOCAL_DEV_SERVER_WORKSPACE_MESSAGE,
    },
  },
] as ConfigPropertyMeta[];
