/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import path from 'node:path';
import process from 'node:process';
import { LWCServer, LogLevel, ServerConfig, Workspace, startLwcDevServer } from '@lwc/lwc-dev-server';
import { Logger } from '@salesforce/core';

const DEV_SERVER_PORT = 8081;

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

function createLWCServerConfig(source: string, logger: Logger): ServerConfig {
  const rootDir = path.resolve(source, 'force-app/main/default');
  const namespacePaths: string[] = [rootDir];

  return {
    rootDir,
    port: DEV_SERVER_PORT,
    protocol: 'wss',
    host: 'localhost',
    paths: namespacePaths,
    workspace: Workspace.SfCli,
    targets: ['LEX'], // should this be something else?
    logLevel: mapLogLevel(logger.getLevel()),
  };
}

export async function startLWCServer(logger: Logger): Promise<LWCServer> {
  const config = createLWCServerConfig(process.cwd(), logger);
  let lwcDevServer: LWCServer | null = await startLwcDevServer(config);

  const cleanup = (): void => {
    if (lwcDevServer) {
      lwcDevServer.stopServer();
      lwcDevServer = null;
    }
  };

  // normal exit flow
  process.on('exit', cleanup);
  // when a user presses ctrl+c
  process.on('SIGINT', cleanup);
  // when a user kills the process
  process.on('SIGTERM', cleanup);

  return lwcDevServer;
}
