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
import { ErrorStore, getErrorStore, resetErrorStore } from '../../src/lwc-dev-server/errorStore.js';
import { ErrorDiagnosticPayload } from '../../src/types/errorPayload.js';

function createMockError(overrides: Partial<ErrorDiagnosticPayload> = {}): ErrorDiagnosticPayload {
  return {
    errorId: 'test-error-' + Math.random(),
    timestamp: new Date().toISOString(),
    error: {
      message: 'Test error',
      name: 'TypeError',
      stack: 'Error stack',
      sanitizedStack: [],
    },
    component: {
      name: 'c-test-component',
      namespace: 'c',
      tagName: 'c-test-component',
      lifecycle: 'connectedCallback',
      filePath: '/path/to/component.js',
    },
    runtime: {
      userAgent: 'Test Agent',
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
      lineNumber: 10,
      columnNumber: 5,
    },
    metadata: {
      severity: 'error',
      wasHandled: false,
      occurrenceCount: 1,
      tags: [],
    },
    ...overrides,
  };
}

describe('ErrorStore', () => {
  let errorStore: ErrorStore;

  beforeEach(() => {
    errorStore = new ErrorStore();
  });

  describe('addError', () => {
    it('should add an error to the store', () => {
      const error = createMockError();
      errorStore.addError(error);

      const stored = errorStore.getError(error.errorId);
      expect(stored).to.deep.equal(error);
    });

    it('should maintain insertion order', () => {
      const error1 = createMockError({
        errorId: 'error1',
        error: { message: 'Error 1', name: 'TypeError', stack: 'stack', sanitizedStack: [] },
      });
      const error2 = createMockError({
        errorId: 'error2',
        error: { message: 'Error 2', name: 'TypeError', stack: 'stack', sanitizedStack: [] },
      });
      const error3 = createMockError({
        errorId: 'error3',
        error: { message: 'Error 3', name: 'TypeError', stack: 'stack', sanitizedStack: [] },
      });

      errorStore.addError(error1);
      errorStore.addError(error2);
      errorStore.addError(error3);

      const errors = errorStore.getErrors();
      expect(errors).to.have.length(3);
      expect(errors[0].errorId).to.equal('error1');
      expect(errors[1].errorId).to.equal('error2');
      expect(errors[2].errorId).to.equal('error3');
    });

    it('should increment occurrence count for duplicate errors', () => {
      const error = createMockError();
      errorStore.addError(error);

      // Add the same error again (same signature)
      const duplicate = createMockError({
        errorId: 'different-id',
        error: error.error,
        component: error.component,
        source: error.source,
      });
      errorStore.addError(duplicate);

      const errors = errorStore.getErrors();
      expect(errors).to.have.length(1);
      expect(errors[0].metadata.occurrenceCount).to.equal(2);
    });

    it('should enforce max size limit', () => {
      const smallStore = new ErrorStore(3);

      const error1 = createMockError({
        errorId: 'error1',
        error: { message: 'Error 1', name: 'TypeError', stack: 'stack', sanitizedStack: [] },
      });
      const error2 = createMockError({
        errorId: 'error2',
        error: { message: 'Error 2', name: 'TypeError', stack: 'stack', sanitizedStack: [] },
      });
      const error3 = createMockError({
        errorId: 'error3',
        error: { message: 'Error 3', name: 'TypeError', stack: 'stack', sanitizedStack: [] },
      });
      const error4 = createMockError({
        errorId: 'error4',
        error: { message: 'Error 4', name: 'TypeError', stack: 'stack', sanitizedStack: [] },
      });

      smallStore.addError(error1);
      smallStore.addError(error2);
      smallStore.addError(error3);
      smallStore.addError(error4);

      const errors = smallStore.getErrors();
      expect(errors).to.have.length(3);
      expect(errors[0].errorId).to.equal('error2');
      expect(errors[1].errorId).to.equal('error3');
      expect(errors[2].errorId).to.equal('error4');
    });
  });

  describe('getError', () => {
    it('should retrieve error by ID', () => {
      const error = createMockError();
      errorStore.addError(error);

      const retrieved = errorStore.getError(error.errorId);
      expect(retrieved).to.deep.equal(error);
    });

    it('should return undefined for non-existent ID', () => {
      const retrieved = errorStore.getError('non-existent');
      expect(retrieved).to.be.undefined;
    });
  });

  describe('getErrors', () => {
    it('should return all errors in order', () => {
      const error1 = createMockError({
        errorId: 'error1',
        error: { message: 'Error 1', name: 'TypeError', stack: 'stack', sanitizedStack: [] },
      });
      const error2 = createMockError({
        errorId: 'error2',
        error: { message: 'Error 2', name: 'TypeError', stack: 'stack', sanitizedStack: [] },
      });

      errorStore.addError(error1);
      errorStore.addError(error2);

      const errors = errorStore.getErrors();
      expect(errors).to.have.length(2);
      expect(errors[0].errorId).to.equal('error1');
      expect(errors[1].errorId).to.equal('error2');
    });

    it('should return empty array when no errors', () => {
      const errors = errorStore.getErrors();
      expect(errors).to.be.an('array').that.is.empty;
    });
  });

  describe('getErrorsByComponent', () => {
    it('should filter errors by component name', () => {
      const error1 = createMockError({
        errorId: 'error1',
        error: { message: 'Error 1', name: 'TypeError', stack: 'stack', sanitizedStack: [] },
        component: { name: 'c-component-a', namespace: 'c', tagName: 'c-component-a', lifecycle: null, filePath: null },
      });
      const error2 = createMockError({
        errorId: 'error2',
        error: { message: 'Error 2', name: 'TypeError', stack: 'stack', sanitizedStack: [] },
        component: { name: 'c-component-b', namespace: 'c', tagName: 'c-component-b', lifecycle: null, filePath: null },
      });
      const error3 = createMockError({
        errorId: 'error3',
        error: { message: 'Error 3', name: 'TypeError', stack: 'stack', sanitizedStack: [] },
        component: { name: 'c-component-a', namespace: 'c', tagName: 'c-component-a', lifecycle: null, filePath: null },
      });

      errorStore.addError(error1);
      errorStore.addError(error2);
      errorStore.addError(error3);

      const filtered = errorStore.getErrorsByComponent('c-component-a');
      expect(filtered).to.have.length(2);
      expect(filtered[0].component.name).to.equal('c-component-a');
      expect(filtered[1].component.name).to.equal('c-component-a');
    });
  });

  describe('getErrorsBySeverity', () => {
    it('should filter errors by severity', () => {
      const error1 = createMockError({
        errorId: 'error1',
        error: { message: 'Error 1', name: 'TypeError', stack: 'stack', sanitizedStack: [] },
        metadata: { severity: 'error', wasHandled: false, occurrenceCount: 1, tags: [] },
      });
      const error2 = createMockError({
        errorId: 'error2',
        error: { message: 'Error 2', name: 'TypeError', stack: 'stack', sanitizedStack: [] },
        metadata: { severity: 'warning', wasHandled: false, occurrenceCount: 1, tags: [] },
      });
      const error3 = createMockError({
        errorId: 'error3',
        error: { message: 'Error 3', name: 'TypeError', stack: 'stack', sanitizedStack: [] },
        metadata: { severity: 'error', wasHandled: false, occurrenceCount: 1, tags: [] },
      });

      errorStore.addError(error1);
      errorStore.addError(error2);
      errorStore.addError(error3);

      const filtered = errorStore.getErrorsBySeverity('error');
      expect(filtered).to.have.length(2);
    });
  });

  describe('getRecentErrors', () => {
    it('should return most recent N errors', () => {
      for (let i = 0; i < 10; i++) {
        errorStore.addError(
          createMockError({
            errorId: `error${i}`,
            error: { message: `Error ${i}`, name: 'TypeError', stack: 'stack', sanitizedStack: [] },
          })
        );
      }

      const recent = errorStore.getRecentErrors(3);
      expect(recent).to.have.length(3);
      expect(recent[0].errorId).to.equal('error7');
      expect(recent[1].errorId).to.equal('error8');
      expect(recent[2].errorId).to.equal('error9');
    });
  });

  describe('clearErrors', () => {
    it('should remove all errors', () => {
      errorStore.addError(createMockError());
      errorStore.addError(createMockError());

      errorStore.clearErrors();

      expect(errorStore.getErrorCount()).to.equal(0);
      expect(errorStore.getErrors()).to.be.empty;
    });
  });

  describe('getErrorCount', () => {
    it('should return correct count', () => {
      expect(errorStore.getErrorCount()).to.equal(0);

      errorStore.addError(
        createMockError({
          errorId: 'error1',
          error: { message: 'Error 1', name: 'TypeError', stack: 'stack', sanitizedStack: [] },
        })
      );
      expect(errorStore.getErrorCount()).to.equal(1);

      errorStore.addError(
        createMockError({
          errorId: 'error2',
          error: { message: 'Error 2', name: 'TypeError', stack: 'stack', sanitizedStack: [] },
        })
      );
      expect(errorStore.getErrorCount()).to.equal(2);
    });
  });

  describe('getStatistics', () => {
    it('should return correct statistics', () => {
      const error1 = createMockError({
        errorId: 'error1',
        error: { message: 'Error 1', name: 'TypeError', stack: 'stack', sanitizedStack: [] },
        component: { name: 'c-component-a', namespace: 'c', tagName: 'c-component-a', lifecycle: null, filePath: null },
        metadata: { severity: 'error', wasHandled: false, occurrenceCount: 1, tags: [] },
      });
      const error2 = createMockError({
        errorId: 'error2',
        error: { message: 'Error 2', name: 'TypeError', stack: 'stack', sanitizedStack: [] },
        component: { name: 'c-component-b', namespace: 'c', tagName: 'c-component-b', lifecycle: null, filePath: null },
        metadata: { severity: 'warning', wasHandled: false, occurrenceCount: 1, tags: [] },
      });

      errorStore.addError(error1);
      errorStore.addError(error2);

      const stats = errorStore.getStatistics();

      expect(stats.totalErrors).to.equal(2);
      expect(stats.totalOccurrences).to.equal(2);
      expect(stats.byComponent['c-component-a']).to.equal(1);
      expect(stats.byComponent['c-component-b']).to.equal(1);
      expect(stats.bySeverity.error).to.equal(1);
      expect(stats.bySeverity.warning).to.equal(1);
    });
  });

  describe('exportAsJSON and importFromJSON', () => {
    it('should export and import errors', () => {
      const error1 = createMockError({
        errorId: 'error1',
        error: { message: 'Export Error 1', name: 'TypeError', stack: 'stack', sanitizedStack: [] },
      });
      const error2 = createMockError({
        errorId: 'error2',
        error: { message: 'Export Error 2', name: 'TypeError', stack: 'stack', sanitizedStack: [] },
      });

      errorStore.addError(error1);
      errorStore.addError(error2);

      const json = errorStore.exportAsJSON();

      const newStore = new ErrorStore();
      const count = newStore.importFromJSON(json);

      expect(count).to.equal(2);
      expect(newStore.getErrorCount()).to.equal(2);
    });

    it('should handle invalid JSON gracefully', () => {
      const count = errorStore.importFromJSON('invalid json');
      expect(count).to.equal(0);
    });
  });
});

describe('getErrorStore singleton', () => {
  afterEach(() => {
    resetErrorStore();
  });

  it('should return same instance on multiple calls', () => {
    const store1 = getErrorStore();
    const store2 = getErrorStore();

    expect(store1).to.equal(store2);
  });

  it('should reset singleton', () => {
    const store1 = getErrorStore();
    resetErrorStore();
    const store2 = getErrorStore();

    expect(store1).to.not.equal(store2);
  });
});
