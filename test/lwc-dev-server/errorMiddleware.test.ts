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

import { expect, use } from 'chai';
import sinon, { SinonStub } from 'sinon';
import sinonChai from 'sinon-chai';
import { Logger } from '@salesforce/core';
import { Request, Response } from 'express';

// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
use(sinonChai);
import {
  createErrorMiddleware,
  createErrorQueryMiddleware,
  createErrorClearMiddleware,
  createErrorStatsMiddleware,
  createCombinedErrorMiddleware,
  createErrorCORSMiddleware,
} from '../../src/lwc-dev-server/errorMiddleware.js';
import { ErrorStore } from '../../src/lwc-dev-server/errorStore.js';
import { ErrorDiagnosticPayload } from '../../src/types/errorPayload.js';

/**
 * Helper function to create a valid test error payload
 */
function createTestError(overrides?: Partial<ErrorDiagnosticPayload>): ErrorDiagnosticPayload {
  const baseError: ErrorDiagnosticPayload = {
    errorId: 'test-error-1',
    timestamp: new Date().toISOString(),
    error: {
      name: 'Error',
      message: 'Test error',
      stack: 'Error: Test error\n    at test.js:5:10',
      sanitizedStack: [],
    },
    component: {
      name: 'testComponent',
      namespace: null,
      tagName: null,
      lifecycle: null,
      filePath: null,
    },
    source: {
      fileName: 'test.js',
      lineNumber: 5,
      columnNumber: 10,
    },
    runtime: {
      userAgent: 'Mozilla/5.0',
      viewport: { width: 1920, height: 1080 },
      url: 'http://localhost:8081',
      lwcVersion: null,
      isDevelopment: true,
    },
    state: {
      props: null,
      publicProperties: [],
      isConnected: true,
    },
    metadata: {
      severity: 'error',
      wasHandled: false,
      occurrenceCount: 1,
      tags: [],
    },
  };

  return { ...baseError, ...overrides };
}

describe('Error Middleware', () => {
  let errorStore: ErrorStore;
  let logger: Logger;
  let req: Request;
  let res: Response;
  let next: sinon.SinonSpy;

  beforeEach(() => {
    errorStore = new ErrorStore(100);
    logger = {
      debug: sinon.stub(),
      info: sinon.stub(),
      warn: sinon.stub(),
      error: sinon.stub(),
    } as unknown as Logger;

    req = {
      method: 'POST',
      path: '/_dev/errors',
      body: {},
      query: {},
    } as Request;

    res = {
      status: sinon.stub().returnsThis(),
      json: sinon.stub().returnsThis(),
      send: sinon.stub().returnsThis(),
      setHeader: sinon.stub().returnsThis(),
    } as unknown as Response;

    next = sinon.spy();
  });

  describe('createErrorMiddleware', () => {
    it('should pass through non-POST requests', () => {
      const middleware = createErrorMiddleware({
        errorStore,
        logger,
        projectRoot: '/test/project',
        logToConsole: false,
      });

      req = { ...req, method: 'GET' } as Request;
      middleware(req, res, next);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(next).to.have.been.calledOnce;
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(res.status).to.not.have.been.called;
    });

    it('should pass through requests to other paths', () => {
      const middleware = createErrorMiddleware({
        errorStore,
        logger,
        projectRoot: '/test/project',
        logToConsole: false,
      });

      req = { ...req, path: '/other/path' } as Request;
      middleware(req, res, next);

      expect(next).to.have.been.calledOnce;
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(res.status).to.not.have.been.called;
    });

    it('should accept valid error payload and store it', () => {
      const middleware = createErrorMiddleware({
        errorStore,
        logger,
        projectRoot: '/test/project',
        logToConsole: false,
      });

      const validPayload = createTestError({
        error: {
          name: 'ReferenceError',
          message: 'nonExistentMethod is not defined',
          stack: 'ReferenceError: nonExistentMethod is not defined\n    at connectedCallback (test.js:5:10)',
          sanitizedStack: [],
        },
        component: {
          name: 'testComponent',
          namespace: null,
          tagName: 'c-test-component',
          lifecycle: 'connectedCallback',
          filePath: null,
        },
      });

      req = { ...req, body: validPayload } as Request;
      middleware(req, res, next);

      // eslint-disable-next-line @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-call
      expect(res.status).to.have.been.calledWith(201);
      // eslint-disable-next-line @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-call
      expect(res.json).to.have.been.calledWith(
        sinon.match({
          success: true,
          errorId: 'test-error-1',
        })
      );
      expect(errorStore.getErrorCount()).to.equal(1);
    });

    it('should reject invalid error payload', () => {
      const middleware = createErrorMiddleware({
        errorStore,
        logger,
        projectRoot: '/test/project',
        logToConsole: false,
      });

      req = { ...req, body: { invalid: 'payload' } } as Request;
      middleware(req, res, next);

      // eslint-disable-next-line @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-call
      expect(res.status).to.have.been.calledWith(400);
      // eslint-disable-next-line @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-call
      expect(res.json).to.have.been.calledWith(
        sinon.match({
          error: 'Invalid error payload',
        })
      );
      expect(errorStore.getErrorCount()).to.equal(0);
    });

    it('should handle errors gracefully', () => {
      const middleware = createErrorMiddleware({
        errorStore,
        logger,
        projectRoot: '/test/project',
        logToConsole: false,
      });

      // Stub addError to throw an error
      sinon.stub(errorStore, 'addError').throws(new Error('Storage error'));

      const validPayload = createTestError({
        errorId: 'test-error-2',
        error: {
          name: 'ReferenceError',
          message: 'test error',
          stack: 'Error stack',
          sanitizedStack: [],
        },
        source: {
          fileName: null,
          lineNumber: null,
          columnNumber: null,
        },
      });

      req = { ...req, body: validPayload } as Request;
      middleware(req, res, next);

      // eslint-disable-next-line @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-call
      expect(res.status).to.have.been.calledWith(500);
      // eslint-disable-next-line @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-call
      expect(res.json).to.have.been.calledWith(
        sinon.match({
          error: 'Internal server error',
        })
      );
    });
  });

  describe('createErrorQueryMiddleware', () => {
    it('should return all errors', () => {
      const middleware = createErrorQueryMiddleware(errorStore);

      // Add test errors
      const error1 = createTestError({
        errorId: 'test-1',
        error: {
          name: 'Error1',
          message: 'First error',
          stack: 'stack',
          sanitizedStack: [],
        },
        component: { name: 'comp1', namespace: null, tagName: null, lifecycle: null, filePath: null },
      });

      errorStore.addError(error1);

      req = { ...req, method: 'GET', path: '/_dev/errors' } as Request;
      middleware(req, res, next);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(res.json).to.have.been.calledOnce;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const response = (res.json as SinonStub).firstCall.args[0];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(response.errors).to.have.lengthOf(1);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(response.errors[0].errorId).to.equal('test-1');
    });

    it('should filter errors by component', () => {
      const middleware = createErrorQueryMiddleware(errorStore);

      const error1 = createTestError({
        errorId: 'test-1',
        error: { name: 'Error1', message: 'First error', stack: 'stack', sanitizedStack: [] },
        component: { name: 'comp1', namespace: null, tagName: null, lifecycle: null, filePath: null },
      });

      const error2 = createTestError({
        errorId: 'test-2',
        component: { name: 'comp2', namespace: null, tagName: null, lifecycle: null, filePath: null },
      });

      errorStore.addError(error1);
      errorStore.addError(error2);

      req = { ...req, method: 'GET', path: '/_dev/errors', query: { component: 'comp1' } } as unknown as Request;
      middleware(req, res, next);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const response = (res.json as SinonStub).firstCall.args[0];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(response.errors).to.have.lengthOf(1);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(response.errors[0].component.name).to.equal('comp1');
    });

    it('should limit results', () => {
      const middleware = createErrorQueryMiddleware(errorStore);

      // Add 3 errors
      for (let i = 0; i < 3; i++) {
        const error = createTestError({
          errorId: `test-${i}`,
          error: { name: 'Error', message: `Error ${i}`, stack: 'stack', sanitizedStack: [] },
        });
        errorStore.addError(error);
      }

      req = { ...req, method: 'GET', path: '/_dev/errors', query: { limit: '2' } } as unknown as Request;
      middleware(req, res, next);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const response = (res.json as SinonStub).firstCall.args[0];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(response.errors).to.have.lengthOf(2);
    });
  });

  describe('createErrorClearMiddleware', () => {
    it('should clear all errors', () => {
      const middleware = createErrorClearMiddleware(errorStore, logger);

      // Add an error
      const error = createTestError();
      errorStore.addError(error);

      expect(errorStore.getErrorCount()).to.equal(1);

      req = { ...req, method: 'DELETE', path: '/_dev/errors' } as Request;
      middleware(req, res, next);

      expect(errorStore.getErrorCount()).to.equal(0);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      expect(res.json).to.have.been.calledWith(
        sinon.match({
          success: true,
        })
      );
    });
  });

  describe('createErrorStatsMiddleware', () => {
    it('should return error statistics', () => {
      const middleware = createErrorStatsMiddleware(errorStore);

      // Add errors
      const error1 = createTestError({
        errorId: 'test-1',
        error: { message: 'Error 1', name: 'TypeError', stack: 'stack', sanitizedStack: [] },
        component: { name: 'comp1', namespace: null, tagName: null, lifecycle: null, filePath: null },
      });

      const error2 = createTestError({
        errorId: 'test-2',
        error: { message: 'Error 2', name: 'TypeError', stack: 'stack', sanitizedStack: [] },
        component: { name: 'comp1', namespace: null, tagName: null, lifecycle: null, filePath: null },
        metadata: { severity: 'warning', wasHandled: false, occurrenceCount: 1, tags: [] },
      });

      errorStore.addError(error1);
      errorStore.addError(error2);

      req = { ...req, method: 'GET', path: '/_dev/errors/stats' } as Request;
      middleware(req, res, next);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const response = (res.json as SinonStub).firstCall.args[0];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(response.statistics.totalErrors).to.equal(2);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(response.statistics.bySeverity.error).to.equal(1);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(response.statistics.bySeverity.warning).to.equal(1);
    });
  });

  describe('createErrorCORSMiddleware', () => {
    it('should set CORS headers', () => {
      const middleware = createErrorCORSMiddleware();

      req = { ...req, path: '/_dev/errors' } as Request;
      middleware(req, res, next);

      // eslint-disable-next-line @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-call
      expect(res.setHeader).to.have.been.calledWith('Access-Control-Allow-Origin', '*');
      // eslint-disable-next-line @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-call
      expect(res.setHeader).to.have.been.calledWith('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      // eslint-disable-next-line @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-call
      expect(res.setHeader).to.have.been.calledWith('Access-Control-Allow-Headers', 'Content-Type');
      expect(next).to.have.been.calledOnce;
    });
  });

  describe('createCombinedErrorMiddleware', () => {
    it('should route to stats endpoint', () => {
      const middleware = createCombinedErrorMiddleware({
        errorStore,
        logger,
        projectRoot: '/test/project',
        logToConsole: false,
      });

      req = { ...req, path: '/_dev/errors/stats', method: 'GET' } as Request;

      middleware(req, res, next);

      expect(res.json).to.have.been.called;
    });

    it('should route POST to error capture', () => {
      const middleware = createCombinedErrorMiddleware({
        errorStore,
        logger,
        projectRoot: '/test/project',
        logToConsole: false,
      });

      const validPayload = createTestError();

      req = { ...req, path: '/_dev/errors', method: 'POST', body: validPayload } as Request;

      middleware(req, res, next);

      // eslint-disable-next-line @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-call
      expect(res.status).to.have.been.calledWith(201);
    });

    it('should route GET to error query', () => {
      const middleware = createCombinedErrorMiddleware({
        errorStore,
        logger,
        projectRoot: '/test/project',
        logToConsole: false,
      });

      req = { ...req, path: '/_dev/errors', method: 'GET' } as Request;

      middleware(req, res, next);

      expect(res.json).to.have.been.called;
    });

    it('should route DELETE to error clear', () => {
      const middleware = createCombinedErrorMiddleware({
        errorStore,
        logger,
        projectRoot: '/test/project',
        logToConsole: false,
      });

      req = { ...req, path: '/_dev/errors', method: 'DELETE' } as Request;

      middleware(req, res, next);

      expect(res.json).to.have.been.called;
    });

    it('should pass through other requests', () => {
      const middleware = createCombinedErrorMiddleware({
        errorStore,
        logger,
        projectRoot: '/test/project',
        logToConsole: false,
      });

      req = { ...req, path: '/other/path', method: 'GET' } as Request;

      middleware(req, res, next);

      expect(next).to.have.been.calledOnce;
    });
  });
});
