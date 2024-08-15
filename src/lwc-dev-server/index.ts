/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { existsSync, lstatSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { LWCServer, LogLevel, ServerConfig, startLwcDevServer, Workspace } from '@lwc/lwc-dev-server';
import { Logger, SfProject } from '@salesforce/core';
import { SSLCertificateData } from '@salesforce/lwc-dev-mobile-core';
import {
  ConfigUtils,
  LOCAL_DEV_SERVER_DEFAULT_HTTP_PORT,
  LOCAL_DEV_SERVER_DEFAULT_WORKSPACE,
} from '../shared/configUtils.js';

/**
 * Map sf cli log level to lwc dev server log level
 * https://github.com/salesforcecli/cli/wiki/Code-Your-Plugin#logging-levels
 *
 * @param cliLogLevel
 * @returns number
 */
function mapLogLevel(cliLogLevel: number): number {
  switch (cliLogLevel) {
    case 10:
      return LogLevel.verbose;
    case 20:
      return LogLevel.debug;
    case 30:
      return LogLevel.info;
    case 40:
      return LogLevel.warn;
    case 50:
      return LogLevel.error;
    case 60:
      return LogLevel.silent;
    default:
      return LogLevel.error;
  }
}

async function createLWCServerConfig(
  // I see y'all doing this a lot.  It's easy/performant to construct child loggers like Logger.childFromRoot('createLWCServerConfig') to make it easier to trace which function is logging
  logger: Logger,
  rootDir: string,
  token: string,
  serverPorts?: { httpPort: number; httpsPort: number },
  certData?: SSLCertificateData,
  workspace?: Workspace
): Promise<ServerConfig> {
  const sfdxConfig = path.resolve(rootDir, 'sfdx-project.json'); // you shouldn't do this.  use SfProject.getInstance(rootDir)

  if (!existsSync(sfdxConfig) || !lstatSync(sfdxConfig).isFile()) {
    throw new Error(`sfdx-project.json not found in ${rootDir}`);
  }

  const sfdxConfigJson = readFileSync(sfdxConfig, 'utf-8');
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const { packageDirectories } = JSON.parse(sfdxConfigJson);
  const namespacePaths: string[] = [];

  for (const dir of packageDirectories) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (dir.path) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
      const resolvedDir = path.resolve(rootDir, dir.path, 'main', 'default'); // main/default is a convention.  It's not always present
      if (existsSync(resolvedDir) && lstatSync(resolvedDir).isDirectory()) {
        logger.debug(`Adding ${resolvedDir} to namespace paths`);
        namespacePaths.push(resolvedDir);
      } else {
        logger.warn(`Skipping ${resolvedDir} because it does not exist or is not a directory`);
      }
    }
  }

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
    logLevel: mapLogLevel(logger.getLevel()),
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
  serverPorts?: { httpPort: number; httpsPort: number },
  certData?: SSLCertificateData,
  workspace?: Workspace
): Promise<LWCServer> {
  const config = await createLWCServerConfig(logger, rootDir, token, serverPorts, certData, workspace);

  logger.trace(`Starting LWC Dev Server with config: ${JSON.stringify(config)}`);
  let lwcDevServer: LWCServer | null = await startLwcDevServer(config);

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
