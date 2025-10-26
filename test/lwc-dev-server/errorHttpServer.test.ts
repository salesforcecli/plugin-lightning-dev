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

import { expect } from 'chai';
import { Logger } from '@salesforce/core';
import sinon from 'sinon';
import { ErrorCaptureServer, startErrorCaptureServer } from '../../src/lwc-dev-server/errorHttpServer.js';
import { ErrorStore } from '../../src/lwc-dev-server/errorStore.js';
import { ErrorDiagnosticPayload } from '../../src/types/errorPayload.js';

/**
 * Helper to create a valid test error payload
 */
function createTestError(): ErrorDiagnosticPayload {
  return {
    errorId: 'test-error-1',
    timestamp: new Date().toISOString(),
    error: {
      name: 'TypeError',
      message: 'Test error',
      stack: 'Error: Test error\n    at test.js:5:10',
      sanitizedStack: [],
    },
    component: {
      name: 'testComponent',
      namespace: 'c',
      tagName: 'c-test-component',
      lifecycle: 'connectedCallback',
      filePath: '/path/to/component.js',
    },
    runtime: {
      userAgent: 'Mozilla/5.0',
      viewport: { width: 1920, height: 1080 },
      url: 'http://localhost:8081',
      lwcVersion: '2.0.0',
      isDevelopment: true,
    },
    state: {
      props: {},
      publicProperties: [],
      isConnected: true,
    },
    source: {
      fileName: 'component.js',
      lineNumber: 5,
      columnNumber: 10,
    },
    metadata: {
      severity: 'error',
      wasHandled: false,
      occurrenceCount: 1,
      tags: [],
    },
  };
}

describe('ErrorCaptureServer', () => {
  let errorStore: ErrorStore;
  let logger: Logger;
  let server: ErrorCaptureServer;

  // Use a random port to avoid conflicts
  const testPort = 9000 + Math.floor(Math.random() * 1000);

  beforeEach(() => {
    errorStore = new ErrorStore(100);
    logger = {
      debug: sinon.stub(),
      info: sinon.stub(),
      warn: sinon.stub(),
      error: sinon.stub(),
      trace: sinon.stub(),
    } as unknown as Logger;
  });

  afterEach(async () => {
    if (server && server.isRunning()) {
      await server.stop();
    }
  });

  describe('constructor', () => {
    it('should create server instance', () => {
      server = new ErrorCaptureServer({
        port: testPort,
        errorStore,
        logger,
        projectRoot: '/test/project',
        logToConsole: false,
      });

      expect(server).to.be.instanceOf(ErrorCaptureServer);
      expect(server.getApp()).to.exist;
    });

    it('should setup middleware', () => {
      server = new ErrorCaptureServer({
        port: testPort,
        errorStore,
        logger,
        projectRoot: '/test/project',
        logToConsole: false,
      });

      const app = server.getApp();
      // Express app should exist and be a function
      expect(app).to.be.a('function');
      expect(app).to.have.property('use');
    });
  });

  describe('start', () => {
    it('should start server on specified port', async () => {
      server = new ErrorCaptureServer({
        port: testPort,
        errorStore,
        logger,
        projectRoot: '/test/project',
        localhostOnly: true,
      });

      await server.start();

      expect(server.isRunning()).to.be.true;
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(logger.info).to.have.been.calledWith(
        sinon.match(`Error capture server started at http://localhost:${testPort}`)
      );
    });

    it('should bind to localhost by default', async () => {
      server = new ErrorCaptureServer({
        port: testPort,
        errorStore,
        logger,
        projectRoot: '/test/project',
        localhostOnly: true,
      });

      await server.start();

      expect(server.isRunning()).to.be.true;
      // Server should be listening
      const serverInstance = server.getServer();
      expect(serverInstance).to.exist;
      expect(serverInstance!.listening).to.be.true;
    });

    it.skip('should reject if port is already in use', async () => {
      // Start first server
      server = new ErrorCaptureServer({
        port: testPort,
        errorStore,
        logger,
        projectRoot: '/test/project',
      });
      await server.start();

      // Wait a bit to ensure server is fully listening
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Try to start second server on same port
      const server2 = new ErrorCaptureServer({
        port: testPort,
        errorStore: new ErrorStore(),
        logger: {
          debug: sinon.stub(),
          info: sinon.stub(),
          warn: sinon.stub(),
          error: sinon.stub(),
          trace: sinon.stub(),
        } as unknown as Logger,
        projectRoot: '/test/project',
      });

      let didThrow = false;
      let errorMessage = '';
      try {
        await server2.start();
      } catch (err) {
        didThrow = true;
        errorMessage = (err as Error).message;
        expect(err).to.be.instanceOf(Error);
        expect(errorMessage).to.include('already in use');
      } finally {
        if (server2.isRunning()) {
          await server2.stop();
        }
      }

      expect(didThrow, `Expected error to be thrown but got none. Last error: ${errorMessage}`).to.be.true;
    });

    it('should log available endpoints', async () => {
      server = new ErrorCaptureServer({
        port: testPort,
        errorStore,
        logger,
        projectRoot: '/test/project',
      });

      await server.start();

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(logger.info).to.have.been.calledWith('[ErrorCapture] Available endpoints:');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(logger.info).to.have.been.calledWith(sinon.match('POST   /_dev/errors'));
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(logger.info).to.have.been.calledWith(sinon.match('GET    /_dev/errors'));
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(logger.info).to.have.been.calledWith(sinon.match('DELETE /_dev/errors'));
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(logger.info).to.have.been.calledWith(sinon.match('GET    /_dev/errors/stats'));
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(logger.info).to.have.been.calledWith(sinon.match('GET    /_dev/health'));
    });
  });

  describe('stop', () => {
    it('should stop running server', async () => {
      server = new ErrorCaptureServer({
        port: testPort,
        errorStore,
        logger,
        projectRoot: '/test/project',
      });

      await server.start();
      expect(server.isRunning()).to.be.true;

      await server.stop();
      expect(server.isRunning()).to.be.false;
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(logger.info).to.have.been.calledWith('[ErrorCapture] Error capture server stopped');
    });

    it('should be safe to call stop on non-running server', async () => {
      server = new ErrorCaptureServer({
        port: testPort,
        errorStore,
        logger,
        projectRoot: '/test/project',
      });

      // Stop without starting
      await server.stop();
      expect(server.isRunning()).to.be.false;
    });

    it('should handle stop errors gracefully', async () => {
      server = new ErrorCaptureServer({
        port: testPort,
        errorStore,
        logger,
        projectRoot: '/test/project',
      });

      await server.start();

      // Force an error by closing the server directly
      const serverInstance = server.getServer();
      serverInstance!.close();

      // Try to stop again (should handle error)
      try {
        await server.stop();
      } catch (err) {
        // Should log error but not crash
        // eslint-disable-next-line @typescript-eslint/unbound-method
        expect(logger.error).to.have.been.called;
      }
    });
  });

  describe('HTTP endpoints', () => {
    beforeEach(async () => {
      server = new ErrorCaptureServer({
        port: testPort,
        errorStore,
        logger,
        projectRoot: '/test/project',
        logToConsole: false,
      });
      await server.start();
    });

    describe('POST /_dev/errors', () => {
      it('should accept valid error payload', async () => {
        const error = createTestError();

        const response = await fetch(`http://localhost:${testPort}/_dev/errors`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(error),
        });

        expect(response.status).to.equal(201);
        const data = (await response.json()) as { success: boolean; errorId: string };
        expect(data.success).to.be.true;
        expect(data.errorId).to.equal(error.errorId);

        // Verify error was stored
        expect(errorStore.getErrorCount()).to.equal(1);
      });

      it('should reject invalid error payload', async () => {
        const invalidPayload = { invalid: 'data' };

        const response = await fetch(`http://localhost:${testPort}/_dev/errors`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invalidPayload),
        });

        expect(response.status).to.equal(400);
        const data = (await response.json()) as { error: string };
        expect(data.error).to.equal('Invalid error payload');

        // Verify error was NOT stored
        expect(errorStore.getErrorCount()).to.equal(0);
      });
    });

    describe('GET /_dev/errors', () => {
      it('should return all errors', async () => {
        // Add test errors with different messages to avoid deduplication
        const error1 = createTestError();
        const error2 = {
          ...createTestError(),
          errorId: 'test-error-2',
          error: {
            name: 'ReferenceError',
            message: 'Different error message',
            stack: 'ReferenceError: Different error\n    at test2.js:10:5',
            sanitizedStack: [],
          },
          source: {
            fileName: 'test2.js',
            lineNumber: 10,
            columnNumber: 5,
          },
        };
        errorStore.addError(error1);
        errorStore.addError(error2);

        const response = await fetch(`http://localhost:${testPort}/_dev/errors`);

        expect(response.status).to.equal(200);
        const data = (await response.json()) as { success: boolean; count: number; errors: ErrorDiagnosticPayload[] };
        expect(data.success).to.be.true;
        expect(data.count).to.equal(2);
        expect(data.errors).to.have.lengthOf(2);
      });

      it('should filter errors by component', async () => {
        const error1 = createTestError();
        const error2 = {
          ...createTestError(),
          errorId: 'test-error-2',
          component: { ...createTestError().component, name: 'otherComponent' },
        };
        errorStore.addError(error1);
        errorStore.addError(error2);

        const response = await fetch(`http://localhost:${testPort}/_dev/errors?component=testComponent`);

        expect(response.status).to.equal(200);
        const data = (await response.json()) as { errors: ErrorDiagnosticPayload[] };
        expect(data.errors).to.have.lengthOf(1);
        expect(data.errors[0].component.name).to.equal('testComponent');
      });

      it('should limit results', async () => {
        // Add 5 errors with distinct properties to avoid deduplication
        for (let i = 0; i < 5; i++) {
          errorStore.addError({
            ...createTestError(),
            errorId: `error-${i}`,
            error: {
              name: 'Error',
              message: `Error message ${i}`,
              stack: `Error: Error message ${i}\n    at test${i}.js:${i}:10`,
              sanitizedStack: [],
            },
            source: {
              fileName: `test${i}.js`,
              lineNumber: i,
              columnNumber: 10,
            },
          });
        }

        const response = await fetch(`http://localhost:${testPort}/_dev/errors?limit=2`);

        expect(response.status).to.equal(200);
        const data = (await response.json()) as { errors: ErrorDiagnosticPayload[] };
        expect(data.errors).to.have.lengthOf(2);
      });
    });

    describe('DELETE /_dev/errors', () => {
      it('should clear all errors', async () => {
        // Add test errors with distinct properties
        errorStore.addError(createTestError());
        errorStore.addError({
          ...createTestError(),
          errorId: 'test-error-2',
          error: {
            name: 'TypeError',
            message: 'Second error message',
            stack: 'TypeError: Second error\n    at test2.js:15:20',
            sanitizedStack: [],
          },
          source: {
            fileName: 'test2.js',
            lineNumber: 15,
            columnNumber: 20,
          },
        });
        expect(errorStore.getErrorCount()).to.equal(2);

        const response = await fetch(`http://localhost:${testPort}/_dev/errors`, {
          method: 'DELETE',
        });

        expect(response.status).to.equal(200);
        const data = (await response.json()) as { success: boolean; clearedCount: number };
        expect(data.success).to.be.true;
        expect(data.clearedCount).to.equal(2);

        // Verify errors were cleared
        expect(errorStore.getErrorCount()).to.equal(0);
      });
    });

    describe('GET /_dev/errors/stats', () => {
      it('should return error statistics', async () => {
        // Add test errors with distinct properties
        const error1 = createTestError();
        const error2 = {
          ...createTestError(),
          errorId: 'test-error-2',
          error: {
            name: 'TypeError',
            message: 'Warning error message',
            stack: 'TypeError: Warning error\n    at test3.js:20:15',
            sanitizedStack: [],
          },
          source: {
            fileName: 'test3.js',
            lineNumber: 20,
            columnNumber: 15,
          },
          metadata: { ...createTestError().metadata, severity: 'warning' as const },
        };
        errorStore.addError(error1);
        errorStore.addError(error2);

        const response = await fetch(`http://localhost:${testPort}/_dev/errors/stats`);

        expect(response.status).to.equal(200);
        const data = (await response.json()) as {
          success: boolean;
          statistics: {
            totalErrors: number;
            bySeverity: { error: number; warning: number; fatal: number };
          };
        };
        expect(data.success).to.be.true;
        expect(data.statistics.totalErrors).to.equal(2);
        expect(data.statistics.bySeverity.error).to.equal(1);
        expect(data.statistics.bySeverity.warning).to.equal(1);
      });
    });

    describe('GET /_dev/health', () => {
      it('should return health status', async () => {
        const response = await fetch(`http://localhost:${testPort}/_dev/health`);

        expect(response.status).to.equal(200);
        const data = (await response.json()) as {
          status: string;
          service: string;
          uptime: number;
          errors: number;
        };
        expect(data.status).to.equal('ok');
        expect(data.service).to.equal('error-capture');
        expect(data.uptime).to.be.a('number');
        expect(data.errors).to.equal(0);
      });
    });

    describe('404 handler', () => {
      it('should return 404 for unknown routes', async () => {
        const response = await fetch(`http://localhost:${testPort}/_dev/unknown`);

        expect(response.status).to.equal(404);
        const data = (await response.json()) as { error: string; message: string };
        expect(data.error).to.equal('Not Found');
        expect(data.message).to.include('Endpoint not found');
      });
    });

    describe('CORS', () => {
      it('should set CORS headers', async () => {
        const response = await fetch(`http://localhost:${testPort}/_dev/errors`, {
          method: 'OPTIONS',
        });

        // OPTIONS requests return 204 No Content (not 200)
        expect(response.status).to.be.oneOf([200, 204]);
        expect(response.headers.get('access-control-allow-origin')).to.equal('*');
        const methods = response.headers.get('access-control-allow-methods');
        expect(methods).to.include('GET');
        expect(methods).to.include('POST');
        expect(methods).to.include('DELETE');
        expect(methods).to.include('OPTIONS');
      });
    });
  });

  describe('startErrorCaptureServer', () => {
    it('should create and start server', async () => {
      server = await startErrorCaptureServer({
        port: testPort,
        errorStore,
        logger,
        projectRoot: '/test/project',
      });

      expect(server).to.be.instanceOf(ErrorCaptureServer);
      expect(server.isRunning()).to.be.true;
    });

    it('should reject if server fails to start', async () => {
      // Start a server on the port first
      server = await startErrorCaptureServer({
        port: testPort,
        errorStore,
        logger,
        projectRoot: '/test/project',
      });

      // Try to start another on same port
      try {
        await startErrorCaptureServer({
          port: testPort,
          errorStore: new ErrorStore(),
          logger,
          projectRoot: '/test/project',
        });
        expect.fail('Should have thrown error');
      } catch (err) {
        expect(err).to.be.instanceOf(Error);
      }
    });
  });

  describe('integration with errorStore', () => {
    beforeEach(async () => {
      server = new ErrorCaptureServer({
        port: testPort,
        errorStore,
        logger,
        projectRoot: '/test/project',
        logToConsole: false,
      });
      await server.start();
    });

    it('should store errors in errorStore', async () => {
      const error = createTestError();

      await fetch(`http://localhost:${testPort}/_dev/errors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(error),
      });

      const storedError = errorStore.getError(error.errorId);
      expect(storedError).to.exist;
      expect(storedError!.errorId).to.equal(error.errorId);
    });

    it('should deduplicate identical errors', async () => {
      const error = createTestError();

      // Send same error twice
      await fetch(`http://localhost:${testPort}/_dev/errors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(error),
      });

      await fetch(`http://localhost:${testPort}/_dev/errors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...error, timestamp: new Date().toISOString() }),
      });

      // Should only have one error with increased occurrence count
      expect(errorStore.getErrorCount()).to.equal(1);
      const errors = errorStore.getErrors();
      expect(errors[0].metadata.occurrenceCount).to.equal(2);
    });
  });
});
