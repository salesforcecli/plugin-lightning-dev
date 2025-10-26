/*
 * Copyright 2025, Salesforce, Inc.
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
import { LWCServer, ServerConfig, startLwcDevServer, Workspace } from '@lwc/lwc-dev-server';
import { Lifecycle, Logger, SfProject } from '@salesforce/core';
import { SSLCertificateData } from '@salesforce/lwc-dev-mobile-core';
import { glob } from 'glob';
import {
  ConfigUtils,
  LOCAL_DEV_SERVER_DEFAULT_HTTP_PORT,
  LOCAL_DEV_SERVER_DEFAULT_WORKSPACE,
} from '../shared/configUtils.js';
import { getErrorStore } from './errorStore.js';
import { startErrorCaptureServer, type ErrorCaptureServer } from './errorHttpServer.js';

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
  const namespacePaths = (
    await Promise.all(packageDirs.map((dir) => glob(`${dir.fullPath}/**/lwc`, { absolute: true })))
  ).flat();

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

  // ============================================================
  // Start standalone error capture HTTP server
  // ============================================================
  const errorStore = getErrorStore();
  const errorCapturePort = (serverPorts?.httpPort ?? LOCAL_DEV_SERVER_DEFAULT_HTTP_PORT) + 1;

  let errorCaptureServer: ErrorCaptureServer | null = null;

  try {
    errorCaptureServer = await startErrorCaptureServer({
      port: errorCapturePort,
      errorStore,
      logger,
      projectRoot: rootDir,
      logToConsole: true,
      localhostOnly: true, // Bind to localhost only for security
    });

    logger.info('[ErrorCapture] Error capture system initialized');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.log(
      `\n⚠️  [ErrorCapture] Failed to start error capture server on port ${errorCapturePort}: ${err instanceof Error ? err.message : String(err)
      }`
    );
    // eslint-disable-next-line no-console
    console.log(
      '⚠️  [ErrorCapture] Error capture will not be available. This does not affect LWC dev server functionality.\n'
    );
    logger.warn(
      `[ErrorCapture] Failed to start error capture server on port ${errorCapturePort}: ${err instanceof Error ? err.message : String(err)
      }`
    );
  }

  const cleanup = (): void => {
    if (lwcDevServer) {
      logger.trace('Stopping LWC Dev Server and Error Capture Server');

      // Show error statistics before shutdown
      const stats = errorStore.getStatistics();
      if (stats.totalErrors > 0) {
        // eslint-disable-next-line no-console
        console.log(`\n📊 [ErrorCapture] Captured ${stats.totalErrors} unique error(s) during this session`);
        // eslint-disable-next-line no-console
        console.log(`📊 [ErrorCapture] Total occurrences: ${stats.totalOccurrences}\n`);
        logger.info(`[ErrorCapture] Captured ${stats.totalErrors} errors during this session`);
      }

      // Stop error capture server first
      if (errorCaptureServer) {
        errorCaptureServer.stop().catch((err) => {
          logger.error(
            `[ErrorCapture] Error stopping error capture server: ${err instanceof Error ? err.message : String(err)}`
          );
        });
        errorCaptureServer = null;
      }

      // Then stop LWC dev server
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

/**
 * Exports the error store for external access (e.g., for testing or CLI commands)
 */
export { getErrorStore, resetErrorStore } from './errorStore.js';
