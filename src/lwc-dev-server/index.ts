/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import process from 'node:process';
import { LWCServer, ServerConfig, startLwcDevServer, Workspace } from '@lwc/lwc-dev-server';
import { Lifecycle, Logger, SfProject } from '@salesforce/core';
import { SSLCertificateData } from '@salesforce/lwc-dev-mobile-core';
import { glob } from 'glob';
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
  workspace?: Workspace
): Promise<ServerConfig> {
  const project = await SfProject.resolve();
  const packageDirs = project.getPackageDirectories();
  const projectJson = await project.resolveProjectConfig();
  const { namespace } = projectJson;

  // e.g. lwc folders in force-app/main/default/lwc, package-dir/lwc
  const namespacePaths = (await Promise.all(packageDirs.map((dir) => glob(`${dir.fullPath}/**/lwc`, { absolute: true })))).flat();

  const ports = serverPorts ??
    (await ConfigUtils.getLocalDevServerPorts()) ?? {
      httpPort: LOCAL_DEV_SERVER_DEFAULT_HTTP_PORT,
      httpsPort: LOCAL_DEV_SERVER_DEFAULT_HTTP_PORT + 1,
    };

  const serverConfig: ServerConfig = {
    rootDir,
    // use custom port if any is provided, or fetch from config file (if any), otherwise use the default port
    port: ports.httpPort,
    paths: namespacePaths,
    // use custom workspace if any is provided, or fetch from config file (if any), otherwise use the default workspace
    workspace: workspace ?? (await ConfigUtils.getLocalDevServerWorkspace()) ?? LOCAL_DEV_SERVER_DEFAULT_WORKSPACE,
    identityToken: token,
    lifecycle: Lifecycle.getInstance(),
    clientType,
    namespace: typeof namespace === 'string' && namespace.trim().length > 0 ? namespace.trim() : undefined,
  };

  if (certData?.pemCertificate && certData.pemPrivateKey) {
    serverConfig.https = {
      cert: certData.pemCertificate,
      key: certData.pemPrivateKey,
      port: ports.httpsPort,
    };
  }

  return serverConfig;
}

export async function startLWCServer(
  logger: Logger,
  rootDir: string,
  token: string,
  clientType: string,
  serverPorts?: { httpPort: number; httpsPort: number },
  certData?: SSLCertificateData,
  workspace?: Workspace
): Promise<LWCServer> {
  const config = await createLWCServerConfig(rootDir, token, clientType, serverPorts, certData, workspace);

  logger.trace(`Starting LWC Dev Server with config: ${JSON.stringify(config)}`);
  let lwcDevServer: LWCServer | null = await startLwcDevServer(config, logger);

  const cleanup = (): void => {
    if (lwcDevServer) {
      logger.trace('Stopping LWC Dev Server');
      lwcDevServer.stopServer();
      lwcDevServer = null;
    }
  };

  [
    'exit', // normal exit flow
    'SIGINT', // when a user presses ctrl+c
    'SIGTERM', // when a user kills the process
  ].forEach((signal) => process.on(signal, cleanup));

  return lwcDevServer;
}
