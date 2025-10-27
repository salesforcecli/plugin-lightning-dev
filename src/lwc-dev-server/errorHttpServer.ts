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

import { Server } from 'node:http';
// eslint-disable-next-line import/no-extraneous-dependencies
import express, { Express } from 'express';
import { Logger } from '@salesforce/core';
import { ErrorStore } from './errorStore.js';
import { createCombinedErrorMiddleware, createErrorCORSMiddleware } from './errorMiddleware.js';

/**
 * Configuration for the standalone error capture HTTP server
 */
export type ErrorServerConfig = {
  /** Port for the error capture server */
  port: number;
  /** Error store instance */
  errorStore: ErrorStore;
  /** Logger instance */
  logger: Logger;
  /** Project root directory */
  projectRoot: string;
  /** Whether to log errors to console */
  logToConsole?: boolean;
  /** Whether to bind to localhost only (recommended for security) */
  localhostOnly?: boolean;
};

/**
 * Standalone HTTP server for error capture endpoints.
 *
 * This server runs independently of the LWC dev server and provides
 * HTTP endpoints for error reporting, querying, and management.
 *
 * Endpoints:
 * - POST /_dev/errors - Capture error reports
 * - GET /_dev/errors - Query stored errors (with filters)
 * - DELETE /_dev/errors - Clear all errors
 * - GET /_dev/errors/stats - Get error statistics
 *
 * @example
 * ```typescript
 * const errorServer = await startErrorCaptureServer({
 *   port: 8082,
 *   errorStore: getErrorStore(),
 *   logger,
 *   projectRoot: '/path/to/project',
 * });
 *
 * // Later...
 * await errorServer.stop();
 * ```
 */
export class ErrorCaptureServer {
  private app: Express;
  private server: Server | null = null;
  private config: ErrorServerConfig;

  public constructor(config: ErrorServerConfig) {
    this.config = config;
    this.app = express();
    this.setupMiddleware();
  }

  /**
   * Start the error capture server
   */
  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      const { port, localhostOnly = true, logger } = this.config;

      try {
        // Bind to localhost only for security (unless explicitly disabled)
        const host = localhostOnly ? 'localhost' : '0.0.0.0';

        this.server = this.app.listen(port, host, () => {
          logger.info(`[ErrorCapture] Error capture server started at http://${host}:${port}`);
          logger.info('[ErrorCapture] Available endpoints:');
          logger.info('[ErrorCapture]   POST   /_dev/errors       - Capture error reports');
          logger.info(
            '[ErrorCapture]   GET    /_dev/errors       - Query errors (supports ?component=, ?severity=, ?limit=)'
          );
          logger.info('[ErrorCapture]   DELETE /_dev/errors       - Clear all errors');
          logger.info('[ErrorCapture]   GET    /_dev/errors/stats - Get statistics');
          logger.info('[ErrorCapture]   GET    /_dev/health       - Health check');
          resolve();
        });

        this.server.on('error', (err: NodeJS.ErrnoException) => {
          if (err.code === 'EADDRINUSE') {
            logger.error(`[ErrorCapture] Port ${port} is already in use. Please use a different port.`);
            reject(new Error(`Port ${port} is already in use`));
          } else {
            logger.error(`[ErrorCapture] Server error: ${err.message}`);
            reject(err);
          }
        });
      } catch (err) {
        logger.error(
          `[ErrorCapture] Failed to start error capture server: ${err instanceof Error ? err.message : String(err)}`
        );
        reject(err);
      }
    });
  }

  /**
   * Stop the error capture server
   */
  public async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close((err) => {
        if (err) {
          this.config.logger.error(`[ErrorCapture] Error stopping server: ${err.message}`);
          reject(err);
        } else {
          this.config.logger.info('[ErrorCapture] Error capture server stopped');
          this.server = null;
          resolve();
        }
      });
    });
  }

  /**
   * Get the underlying Express app (for testing)
   */
  public getApp(): Express {
    return this.app;
  }

  /**
   * Get the server instance (for testing)
   */
  public getServer(): Server | null {
    return this.server;
  }

  /**
   * Check if server is running
   */
  public isRunning(): boolean {
    return this.server !== null && this.server.listening;
  }

  /**
   * Set up Express middleware
   */
  private setupMiddleware(): void {
    const { errorStore, logger, projectRoot, logToConsole = true } = this.config;

    // Parse JSON request bodies
    this.app.use(express.json({ limit: '10mb' }));

    // Enable CORS for error endpoints
    this.app.use(createErrorCORSMiddleware());

    // Add combined error middleware
    const errorMiddleware = createCombinedErrorMiddleware({
      errorStore,
      logger,
      projectRoot,
      logToConsole,
    });
    this.app.use(errorMiddleware);

    // Health check endpoint
    this.app.get('/_dev/health', (_req, res) => {
      res.json({
        status: 'ok',
        service: 'error-capture',
        uptime: process.uptime(),
        errors: errorStore.getErrorCount(),
      });
    });

    // Catch-all for unknown routes
    this.app.use((_req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: 'Endpoint not found. Available endpoints: POST/GET/DELETE /_dev/errors, GET /_dev/errors/stats',
      });
    });
  }
}

/**
 * Convenience function to start an error capture server
 *
 * @param config - Server configuration
 * @returns Running ErrorCaptureServer instance
 */
export async function startErrorCaptureServer(config: ErrorServerConfig): Promise<ErrorCaptureServer> {
  const server = new ErrorCaptureServer(config);
  await server.start();
  return server;
}
