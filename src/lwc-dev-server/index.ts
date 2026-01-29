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
import { LWCServer, ServerConfig, startLwcDevServer, Workspace } from '@lwc/lwc-dev-server';
import { Lifecycle, Logger, SfProject, AuthInfo, Connection } from '@salesforce/core';
import { SSLCertificateData, Platform } from '@salesforce/lwc-dev-mobile-core';
import { glob } from 'glob';
import {
  ConfigUtils,
  LOCAL_DEV_SERVER_DEFAULT_HTTP_PORT,
  LOCAL_DEV_SERVER_DEFAULT_WORKSPACE,
} from '../shared/configUtils.js';
import { PreviewUtils } from '../shared/previewUtils.js';

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
  const { namespace } = projectJson as { namespace?: string };

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
  // Validate JWT authentication before starting the server
  await ensureJwtAuth(clientType);

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

/**
 * Helper function to ensure JWT authentication is valid
 */
async function ensureJwtAuth(username: string): Promise<AuthInfo> {
  try {
    // Create AuthInfo - this will throw if authentication is invalid
    const authInfo = await AuthInfo.create({ username });

    // Verify the AuthInfo has valid credentials
    const authUsername = authInfo.getUsername();
    if (!authUsername) {
      throw new Error('AuthInfo created but username is not available');
    }

    return authInfo;
  } catch (e) {
    const errorMessage = (e as Error).message;
    // Provide more helpful error messages based on common authentication issues
    if (errorMessage.includes('No authorization information found')) {
      throw new Error(
        `JWT authentication not found for user ${username}. Please run 'sf org login jwt' or 'sf org login web' first.`
      );
    } else if (
      errorMessage.includes('expired') ||
      errorMessage.includes('Invalid JWT token') ||
      errorMessage.includes('invalid signature')
    ) {
      throw new Error(
        `JWT authentication expired or invalid for user ${username}. Please re-authenticate using 'sf org login jwt' or 'sf org login web'.`
      );
    } else {
      throw new Error(`JWT authentication not found or invalid for user ${username}: ${errorMessage}`);
    }
  }
}

/**
 * Configuration for starting the local dev server programmatically
 */
export type LocalDevServerConfig = {
  /** Target org connection */
  targetOrg: unknown;
  /** Component name to preview */
  componentName?: string;
  /** Platform for preview (defaults to desktop) */
  platform?: Platform;
  /** Custom port configuration */
  ports?: {
    httpPort?: number;
    httpsPort?: number;
  };
  /** Logger instance */
  logger?: Logger;
};

/**
 * Result from starting the local dev server
 */
export type LocalDevServerResult = {
  /** Local dev server URL */
  url: string;
  /** Server ID for authentication */
  serverId: string;
  /** Authentication token */
  token: string;
  /** Server ports */
  ports: {
    httpPort: number;
    httpsPort: number;
  };
  /** Server process for cleanup */
  process?: LWCServer;
};

/**
 * Programmatic API for starting the local dev server
 * This can be used to start the server without CLI
 */
export class LocalDevServerManager {
  private static instance: LocalDevServerManager;
  private activeServers: Map<string, LocalDevServerResult> = new Map();

  private constructor() {}

  public static getInstance(): LocalDevServerManager {
    if (!LocalDevServerManager.instance) {
      LocalDevServerManager.instance = new LocalDevServerManager();
    }
    return LocalDevServerManager.instance;
  }

  /**
   * Start the local dev server programmatically
   *
   * @param config Configuration for the server
   * @returns Promise with server details including URL for iframing
   */
  public async startServer(config: LocalDevServerConfig): Promise<LocalDevServerResult> {
    const logger = config.logger ?? (await Logger.child('LocalDevServerManager'));
    const platform = config.platform ?? Platform.desktop;

    if (typeof config.targetOrg !== 'string') {
      const error = new Error('targetOrg must be a valid username string.');
      logger.error('Invalid targetOrg parameter', { targetOrg: config.targetOrg });
      throw error;
    }

    logger.info('Starting Local Dev Server', { platform: platform.toString(), targetOrg: config.targetOrg });

    let sfdxProjectRootPath = '';
    try {
      sfdxProjectRootPath = await SfProject.resolveProjectPath();
      logger.debug('SFDX project path resolved', { path: sfdxProjectRootPath });
    } catch (error) {
      const errorMessage = `No SFDX project found: ${(error as Error)?.message || ''}`;
      logger.error('Failed to resolve SFDX project path', { error: errorMessage });
      throw new Error(errorMessage);
    }

    try {
      logger.debug('Validating JWT authentication', { targetOrg: config.targetOrg });
      const authInfo = await ensureJwtAuth(config.targetOrg);
      const connection = await Connection.create({ authInfo });

      const ldpServerToken = connection.getConnectionOptions().accessToken;
      if (!ldpServerToken) {
        const error = new Error(
          'Unable to retrieve access token from targetOrg. Ensure the org is authenticated and has a valid session.'
        );
        logger.error('Access token retrieval failed', { targetOrg: config.targetOrg });
        throw error;
      }

      const ldpServerId = authInfo.getUsername(); // Using username as server ID
      logger.debug('Authentication successful', { serverId: ldpServerId });

      const serverPorts = config.ports
        ? { httpPort: config.ports.httpPort ?? 3333, httpsPort: config.ports.httpsPort ?? 3334 }
        : await PreviewUtils.getNextAvailablePorts();

      logger.debug('Server ports configured', { ports: serverPorts });

      const ldpServerUrl = PreviewUtils.generateWebSocketUrlForLocalDevServer(platform, serverPorts, logger);

      logger.info('Starting LWC Dev Server process', { ports: serverPorts });
      const serverProcess = await startLWCServer(
        logger,
        sfdxProjectRootPath,
        ldpServerToken,
        platform.toString(),
        serverPorts
      );

      const result: LocalDevServerResult = {
        url: ldpServerUrl,
        serverId: ldpServerId,
        token: ldpServerToken,
        ports: serverPorts,
        process: serverProcess,
      };

      // Store active server for cleanup
      this.activeServers.set(ldpServerId, result);

      logger.info(`LWC Dev Server started successfully at ${ldpServerUrl}`, {
        serverId: ldpServerId,
        ports: serverPorts,
        url: ldpServerUrl,
      });

      return result;
    } catch (error) {
      logger.error('Failed to start Local Dev Server', {
        error: (error as Error).message,
        targetOrg: config.targetOrg,
      });
      throw error;
    }
  }

  /**
   * Stop a specific server
   *
   * @param serverId Server ID to stop
   */
  public stopServer(serverId: string): void {
    const server = this.activeServers.get(serverId);
    if (server?.process) {
      server.process.stopServer();
      this.activeServers.delete(serverId);
    }
  }

  /**
   * Stop all active servers
   */
  public stopAllServers(): void {
    const serverIds = Array.from(this.activeServers.keys());
    serverIds.forEach((serverId) => this.stopServer(serverId));
  }
}

// Export the new programmatic API
export const localDevServerManager = LocalDevServerManager.getInstance();
