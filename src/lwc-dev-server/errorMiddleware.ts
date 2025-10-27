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

// eslint-disable-next-line import/no-extraneous-dependencies
import { Request, Response, NextFunction } from 'express';
import { Logger } from '@salesforce/core';
import { isValidErrorPayload, ErrorDiagnosticPayload } from '../types/errorPayload.js';
import { parseStackTrace } from '../shared/stackTraceUtils.js';
import { formatErrorForCLI } from '../shared/errorFormatter.js';
import { ErrorStore } from './errorStore.js';

/**
 * Configuration for error middleware
 */
export type ErrorMiddlewareConfig = {
  /** Error store instance */
  errorStore: ErrorStore;
  /** Logger instance */
  logger: Logger;
  /** Project root directory for stack trace sanitization */
  projectRoot: string;
  /** Whether to log errors to console */
  logToConsole?: boolean;
};

/**
 * Creates Express middleware for handling runtime error reports from the browser.
 *
 * This middleware provides a POST /_dev/errors endpoint that receives error diagnostic
 * payloads from the client-side error capture system, stores them, and logs them to the CLI.
 *
 * @param config - Middleware configuration
 * @returns Express middleware function
 */
export function createErrorMiddleware(
  config: ErrorMiddlewareConfig
): (req: Request, res: Response, next: NextFunction) => void {
  const { errorStore, logger, projectRoot, logToConsole = true } = config;

  return (req: Request, res: Response, next: NextFunction): void => {
    // Only handle POST requests to /_dev/errors
    if (req.method !== 'POST' || !req.path.startsWith('/_dev/errors')) {
      next();
      return;
    }

    try {
      // Parse request body
      const payload = req.body as unknown;

      // Validate payload structure
      if (!isValidErrorPayload(payload)) {
        res.status(400).json({
          error: 'Invalid error payload',
          message: 'Payload does not match ErrorDiagnosticPayload schema',
        });
        return;
      }

      const error = payload;

      // Clean up client-only fields (used for browser logging, not needed on server)
      // eslint-disable-next-line no-underscore-dangle
      if ('_clientParsedStack' in error.error) {
        // eslint-disable-next-line no-underscore-dangle
        delete (error.error as Record<string, unknown>)._clientParsedStack;
      }

      // Enhance stack trace with project context
      if (error.error.stack && error.error.sanitizedStack.length === 0) {
        error.error.sanitizedStack = parseStackTrace(error.error.stack, projectRoot);
      }

      // Store the error
      errorStore.addError(error);

      // Log to console if enabled
      if (logToConsole) {
        const formatted = formatErrorForCLI(error, {
          colorize: true,
          showFullStack: false, // Only show local source frames, hide framework/library code
          compact: false,
        });
        // eslint-disable-next-line no-console
        console.error('\n🔴 [ErrorCapture] Runtime Error Detected:\n');
        // eslint-disable-next-line no-console
        console.error(formatted);
        // eslint-disable-next-line no-console
        console.error(''); // blank line for spacing
        logger.error(formatted);
      }

      // Log to debug
      logger.debug(`Error captured: ${error.errorId} - ${error.error.name}: ${error.error.message}`);

      // Send success response
      res.status(201).json({
        success: true,
        errorId: error.errorId,
        message: 'Error captured successfully',
      });
    } catch (err) {
      logger.error(`Failed to process error report: ${(err as Error).message}`);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to process error report',
      });
    }
  };
}

/**
 * Creates middleware for retrieving stored errors (GET /_dev/errors)
 *
 * @param errorStore - Error store instance
 * @returns Express middleware function
 */
export function createErrorQueryMiddleware(errorStore: ErrorStore) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Only handle GET requests to /_dev/errors
    if (req.method !== 'GET' || !req.path.startsWith('/_dev/errors')) {
      next();
      return;
    }

    try {
      const { component, severity, limit = '100' } = req.query;

      let errors = errorStore.getErrors();

      // Filter by component if specified
      if (typeof component === 'string') {
        errors = errors.filter((e: ErrorDiagnosticPayload) => e.component.name === component);
      }

      // Filter by severity if specified
      if (typeof severity === 'string' && (severity === 'error' || severity === 'warning' || severity === 'fatal')) {
        errors = errors.filter((e: ErrorDiagnosticPayload) => e.metadata.severity === severity);
      }

      // Limit results
      const limitNum = parseInt(limit as string, 10) || 100;
      errors = errors.slice(-limitNum);

      res.json({
        success: true,
        count: errors.length,
        errors,
      });
    } catch (err) {
      res.status(500).json({
        error: 'Internal server error',
        message: (err as Error).message,
      });
    }
  };
}

/**
 * Creates middleware for clearing stored errors (DELETE /_dev/errors)
 *
 * @param errorStore - Error store instance
 * @param logger - Logger instance
 * @returns Express middleware function
 */
export function createErrorClearMiddleware(errorStore: ErrorStore, logger: Logger) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Only handle DELETE requests to /_dev/errors
    if (req.method !== 'DELETE' || !req.path.startsWith('/_dev/errors')) {
      next();
      return;
    }

    try {
      const count = errorStore.getErrorCount();
      errorStore.clearErrors();

      if (count > 0) {
        // eslint-disable-next-line no-console
        console.log(`\n🧹 [ErrorCapture] Cleared ${count} error(s) from store\n`);
      }
      logger.debug(`Cleared ${count} stored errors`);

      res.json({
        success: true,
        message: `Cleared ${count} errors`,
        clearedCount: count,
      });
    } catch (err) {
      res.status(500).json({
        error: 'Internal server error',
        message: (err as Error).message,
      });
    }
  };
}

/**
 * Creates middleware for getting error statistics (GET /_dev/errors/stats)
 *
 * @param errorStore - Error store instance
 * @returns Express middleware function
 */
export function createErrorStatsMiddleware(errorStore: ErrorStore) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Only handle GET requests to /_dev/errors/stats
    if (req.method !== 'GET' || req.path !== '/_dev/errors/stats') {
      next();
      return;
    }

    try {
      const stats = errorStore.getStatistics();

      res.json({
        success: true,
        statistics: stats,
      });
    } catch (err) {
      res.status(500).json({
        error: 'Internal server error',
        message: (err as Error).message,
      });
    }
  };
}

/**
 * Combines all error-related middleware into a single middleware function
 *
 * @param config - Middleware configuration
 * @returns Combined Express middleware function
 */
export function createCombinedErrorMiddleware(
  config: ErrorMiddlewareConfig
): (req: Request, res: Response, next: NextFunction) => void {
  const postMiddleware = createErrorMiddleware(config);
  const getMiddleware = createErrorQueryMiddleware(config.errorStore);
  const deleteMiddleware = createErrorClearMiddleware(config.errorStore, config.logger);
  const statsMiddleware = createErrorStatsMiddleware(config.errorStore);

  return (req: Request, res: Response, next: NextFunction): void => {
    // Route to appropriate handler based on path and method
    if (req.path === '/_dev/errors/stats') {
      statsMiddleware(req, res, next);
    } else if (req.path.startsWith('/_dev/errors')) {
      if (req.method === 'POST') {
        void postMiddleware(req, res, next);
      } else if (req.method === 'GET') {
        getMiddleware(req, res, next);
      } else if (req.method === 'DELETE') {
        deleteMiddleware(req, res, next);
      } else {
        next();
      }
    } else {
      next();
    }
  };
}

/**
 * Middleware to enable CORS for error reporting endpoints
 * Necessary for browser-based error reporting from Salesforce org pages
 */
export function createErrorCORSMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.path.startsWith('/_dev/errors')) {
      // Allow CORS from any origin for local development
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      // Handle preflight
      if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
      }
    }
    next();
  };
}
