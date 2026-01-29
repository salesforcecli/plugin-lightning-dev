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

import process from 'node:process';
import type { LWCServer, ServerConfig, Workspace } from '@lwc/sfdx-local-dev-dist';
import { Connection, Lifecycle, Logger, SfProject } from '@salesforce/core';
import { SSLCertificateData } from '@salesforce/lwc-dev-mobile-core';
import { glob } from 'glob';
import { loadLwcModule } from '../shared/dependencyLoader.js';
import {
  ConfigUtils,
  LOCAL_DEV_SERVER_DEFAULT_HTTP_PORT,
  LOCAL_DEV_SERVER_DEFAULT_WORKSPACE,
} from '../shared/configUtils.js';

async function createLWCServerConfig(
  rootDir: string,
  token: string,
  clientType: string,
  serverPorts?: { httpPort: number; httpsPort: number },
  certData?: SSLCertificateData,
  workspace?: Workspace,
): Promise<ServerConfig> {
  const project = await SfProject.resolve();
  const packageDirs = project.getPackageDirectories();
  const projectJson = await project.resolveProjectConfig();
  const { namespace } = projectJson;

  // e.g. lwc folders in force-app/main/default/lwc, package-dir/lwc
  const namespacePaths = (
    await Promise.all(packageDirs.map((dir) => glob(`${dir.fullPath}/**/lwc`, { absolute: true })))
  ).flat();

  const ports = serverPorts ??
    (await ConfigUtils.getLocalDevServerPorts()) ?? {
      httpPort: LOCAL_DEV_SERVER_DEFAULT_HTTP_PORT,
      httpsPort: LOCAL_DEV_SERVER_DEFAULT_HTTP_PORT + 1,
    };

  const resolvedWorkspace: Workspace = (workspace ??
    (await ConfigUtils.getLocalDevServerWorkspace()) ??
    LOCAL_DEV_SERVER_DEFAULT_WORKSPACE) as Workspace;

  const serverConfig: ServerConfig = {
    rootDir,
    // use custom port if any is provided, or fetch from config file (if any), otherwise use the default port
    port: ports.httpPort,
    paths: namespacePaths,
    // use custom workspace if any is provided, or fetch from config file (if any), otherwise use the default workspace
    workspace: resolvedWorkspace,
    identityToken: token,
    lifecycle: Lifecycle.getInstance() as unknown as ServerConfig['lifecycle'],
    clientType,
    namespace: typeof namespace === 'string' && namespace.trim().length > 0 ? namespace.trim() : undefined,
  };

  if (certData?.pemCertificate && certData.pemPrivateKey) {
    const httpsConfig: ServerConfig['https'] = {
      cert: certData.pemCertificate,
      key: certData.pemPrivateKey,
      port: ports.httpsPort,
    };
    serverConfig.https = httpsConfig;
  }

  return serverConfig;
}

export async function startLWCServer(
  logger: Logger,
  connection: Connection,
  rootDir: string,
  token: string,
  clientType: string,
  serverPorts?: { httpPort: number; httpsPort: number },
  certData?: SSLCertificateData,
  workspace?: Workspace,
): Promise<LWCServer> {
  const orgApiVersion = connection.version;
  logger.trace(`Starting LWC server for org API version: ${orgApiVersion}`);

  const lwcDevServerModule = await loadLwcModule(orgApiVersion);

  const config: ServerConfig = await createLWCServerConfig(
    rootDir,
    token,
    clientType,
    serverPorts,
    certData,
    workspace,
  );

  logger.trace(`Starting LWC Dev Server with config: ${JSON.stringify(config)}`);
  const lwcDevServerResult = await lwcDevServerModule.startLwcDevServer(config, logger);
  const lwcDevServer = lwcDevServerResult as LWCServer;

  const cleanup = (): void => {
    if (lwcDevServer) {
      logger.trace('Stopping LWC Dev Server');
      lwcDevServer.stopServer();
    }
  };

  [
    'exit', // normal exit flow
    'SIGINT', // when a user presses ctrl+c
    'SIGTERM', // when a user kills the process
  ].forEach((signal) => process.on(signal, cleanup));

  return lwcDevServer;
}
