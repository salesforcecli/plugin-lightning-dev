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

import { Workspace } from '@lwc/sfdx-local-dev-dist';
import { ConfigPropertyMeta, ConfigValue, Messages } from '@salesforce/core';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-lightning-dev', 'shared.utils');
const IDENTITY_DATA_DESC = messages.getMessage('config-utils.data-desc');
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
   * The identity data is a data structure that links the local web server's
   * identity token to the user's configured Salesforce orgs.
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
    description: IDENTITY_DATA_DESC,
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
