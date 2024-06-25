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
const IDENTITY_TOKEN_DESC = messages.getMessage('config-utils.token-desc');
const HTTPS_FILES_DESC = messages.getMessage('config-utils.https-desc');
const HTTPS_FILES_ERROR_MESSAGE = messages.getMessage('config-utils.https-error-message');
const LOCAL_DEV_SERVER_PORT_DESC = messages.getMessage('config-utils.port-desc');
const LOCAL_DEV_SERVER_PORT_ERROR_MESSAGE = messages.getMessage('config-utils.port-error-message');
const LOCAL_DEV_SERVER_WORKSPACE_DESC = messages.getMessage('config-utils.workspace-desc');
const LOCAL_DEV_SERVER_WORKSPACE_ERROR_MESSAGE = messages.getMessage('config-utils.workspace-error-message');

export const enum ConfigVars {
  /**
   * The Base64-encoded identity token of the local web server, used to
   * validate the web server's identity to the hmr-client.
   */
  LOCAL_WEB_SERVER_IDENTITY_TOKEN = 'local-web-server-identity-token',

  /**
   * The path to certificate and private key files
   */
  LOCAL_WEB_SERVER_HTTPS_CERT_AND_KEY_FILES = 'https',

  /**
   * The port number of the local dev server.
   */
  LOCAL_DEV_SERVER_PORT = 'local-dev-server-port',

  /**
   * The Workspace name of the local dev server.
   */
  LOCAL_DEV_SERVER_WORKSPACE = 'local-dev-server-workspace',
}

export type SecureConnectionFiles = {
  pemKeyFilePath: string;
  pemCertFilePath: string;
  derCertFilePath: string;
};

export default [
  {
    key: ConfigVars.LOCAL_WEB_SERVER_IDENTITY_TOKEN,
    description: IDENTITY_TOKEN_DESC,
    hidden: true,
    encrypted: true,
  },
  {
    key: ConfigVars.LOCAL_WEB_SERVER_HTTPS_CERT_AND_KEY_FILES,
    description: HTTPS_FILES_DESC,
    input: {
      validator: (value: ConfigValue): boolean => {
        const secureConnectionFiles = value as SecureConnectionFiles;
        if (!secureConnectionFiles?.pemCertFilePath || !secureConnectionFiles?.pemKeyFilePath) {
          return false;
        }

        return true;
      },
      failedMessage: HTTPS_FILES_ERROR_MESSAGE,
    },
  },
  {
    key: ConfigVars.LOCAL_DEV_SERVER_PORT,
    description: LOCAL_DEV_SERVER_PORT_DESC,
    input: {
      validator: (value: ConfigValue): boolean => {
        if (!value) {
          return false;
        }

        const parsedPort = parseInt(value as string, 10);

        if (isNaN(parsedPort) || parsedPort < 1 || parsedPort > 65_535) {
          return false;
        }
        return true;
      },
      failedMessage: LOCAL_DEV_SERVER_PORT_ERROR_MESSAGE,
    },
  },
  {
    key: ConfigVars.LOCAL_DEV_SERVER_WORKSPACE,
    description: LOCAL_DEV_SERVER_WORKSPACE_DESC,
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
      failedMessage: LOCAL_DEV_SERVER_WORKSPACE_ERROR_MESSAGE,
    },
  },
] as ConfigPropertyMeta[];
