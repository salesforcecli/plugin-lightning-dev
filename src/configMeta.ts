/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Workspace } from '@lwc/lwc-dev-server';
import { ConfigPropertyMeta, ConfigValue, Messages } from '@salesforce/core';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-lightning-dev', 'shared.utils');
const IDENTITY_TOKEN_DESC = messages.getMessage('config-utils.token-desc');
const LOCAL_DEV_SERVER_CERT_DESC = messages.getMessage('config-utils.cert-desc');
const LOCAL_DEV_SERVER_CERT_ERROR_MESSAGE = messages.getMessage('config-utils.cert-error-message');
const LOCAL_DEV_SERVER_PORT_DESC = messages.getMessage('config-utils.port-desc');
const LOCAL_DEV_SERVER_PORT_ERROR_MESSAGE = messages.getMessage('config-utils.port-error-message');
const LOCAL_DEV_SERVER_WORKSPACE_DESC = messages.getMessage('config-utils.workspace-desc');
const LOCAL_DEV_SERVER_WORKSPACE_ERROR_MESSAGE = messages.getMessage('config-utils.workspace-error-message');

export type SerializedSSLCertificateData = {
  derCertificate: string;
  pemCertificate: string;
  pemPrivateKey: string;
  pemPublicKey: string;
};

export const enum ConfigVars {
  /**
   * The identity data is a data structure that ties together a single
   * local web server identity token to multiple orgs.
   */
  LOCAL_WEB_SERVER_IDENTITY_DATA = 'local-web-server-identity-data',

  /**
   * The SSL certificate data to be used by local dev server
   */
  LOCAL_DEV_SERVER_HTTPS_CERT_DATA = 'local-dev-server-certificate-data',

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
    key: ConfigVars.LOCAL_WEB_SERVER_IDENTITY_DATA,
    description: IDENTITY_TOKEN_DESC,
    hidden: true,
    encrypted: true,
  },
  {
    key: ConfigVars.LOCAL_DEV_SERVER_HTTPS_CERT_DATA,
    description: LOCAL_DEV_SERVER_CERT_DESC,
    input: {
      validator: (value: ConfigValue): boolean => {
        const data = value as SerializedSSLCertificateData;
        if (!data?.derCertificate || !data?.pemCertificate || !data?.pemPrivateKey) {
          return false;
        }

        return true;
      },
      failedMessage: LOCAL_DEV_SERVER_CERT_ERROR_MESSAGE,
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
