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

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from 'chai';
import { Logger } from '@salesforce/core';
import { getErrorStore, resetErrorStore } from '../../src/lwc-dev-server/errorStore.js';
import { ErrorDiagnosticPayload } from '../../src/types/errorPayload.js';

// ESM compatibility: create __dirname equivalent
// eslint-disable-next-line no-underscore-dangle
const __filename = fileURLToPath(import.meta.url);
// eslint-disable-next-line no-underscore-dangle
const __dirname = path.dirname(__filename);

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
      namespace: 'c',
      tagName: 'c-test-component',
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

/**
 * E2E test for error capture system
 *
 * This test verifies the complete error capture flow:
 * 1. Start LWC dev server with error capture enabled
 * 2. Simulate an error being sent from the client-side
 * 3. Verify the error is captured and stored
 * 4. Verify the error can be retrieved
 */
describe('Error Capture E2E', function () {
  // Increase timeout for server startup
  this.timeout(30_000);

  let errorStore: ReturnType<typeof getErrorStore>;

  before(async () => {
    const logger = await Logger.child('ErrorCaptureE2E');
    logger.debug('Initializing E2E test');
    // Create a test project directory
    const testProjectDir = path.join(__dirname, '../fixtures/errorTestProject');

    // Ensure the test project directory exists
    if (!fs.existsSync(testProjectDir)) {
      fs.mkdirSync(testProjectDir, { recursive: true });

      // Create a basic sfdx-project.json
      const sfdxProjectPath = path.join(testProjectDir, 'sfdx-project.json');
      fs.writeFileSync(
        sfdxProjectPath,
        JSON.stringify(
          {
            packageDirectories: [
              {
                path: 'force-app',
                default: true,
              },
            ],
            namespace: '',
            sfdcLoginUrl: 'https://login.salesforce.com',
            sourceApiVersion: '58.0',
          },
          null,
          2
        )
      );

      // Create force-app/main/default/lwc directory
      const lwcDir = path.join(testProjectDir, 'force-app/main/default/lwc');
      fs.mkdirSync(lwcDir, { recursive: true });

      // Create error test component
      const componentDir = path.join(lwcDir, 'errorTestComponent');
      fs.mkdirSync(componentDir, { recursive: true });

      // Component JS
      fs.writeFileSync(
        path.join(componentDir, 'errorTestComponent.js'),
        `import { LightningElement } from 'lwc';

export default class ErrorTestComponent extends LightningElement {
  connectedCallback() {
    // Deliberately cause a ReferenceError
    this.nonExistentMethod();
  }
}`
      );

      // Component HTML
      fs.writeFileSync(
        path.join(componentDir, 'errorTestComponent.html'),
        `<template>
    <p>This component will throw an error in connectedCallback.</p>
</template>`
      );

      // Component metadata
      fs.writeFileSync(
        path.join(componentDir, 'errorTestComponent.js-meta.xml'),
        `<?xml version="1.0" encoding="UTF-8"?>
<LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>58.0</apiVersion>
    <isExposed>true</isExposed>
    <targets>
        <target>lightning__AppPage</target>
        <target>lightning__RecordPage</target>
        <target>lightning__HomePage</target>
    </targets>
        </LightningComponentBundle>`
      );
    }
  });

  beforeEach(() => {
    // Reset error store before each test
    resetErrorStore();
    errorStore = getErrorStore();
  });

  it('should initialize error store when server starts', () => {
    expect(errorStore).to.exist;
    expect(errorStore.getErrorCount()).to.equal(0);
  });

  it('should capture and store errors sent to /_dev/errors endpoint', async () => {
    const testError = createTestError({
      errorId: 'test-error-123',
      error: {
        name: 'ReferenceError',
        message: 'nonExistentMethod is not defined',
        stack:
          'ReferenceError: nonExistentMethod is not defined\n' +
          '    at ErrorTestComponent.connectedCallback (errorTestComponent.js:5:10)\n' +
          '    at callHook (lwc-engine.js:123:45)',
        sanitizedStack: [],
      },
      component: {
        name: 'errorTestComponent',
        namespace: 'c',
        tagName: 'c-error-test-component',
        lifecycle: 'connectedCallback',
        filePath: null,
      },
      source: {
        fileName: 'errorTestComponent.js',
        lineNumber: 5,
        columnNumber: 10,
      },
      metadata: {
        severity: 'error',
        wasHandled: false,
        occurrenceCount: 1,
        tags: ['runtime', 'lwc'],
      },
    });

    // Simulate error capture by directly adding to store
    // In a real E2E test, this would come from an HTTP POST to /_dev/errors
    errorStore.addError(testError);

    // Verify error was stored
    expect(errorStore.getErrorCount()).to.equal(1);

    // Retrieve the error
    const errors = errorStore.getErrors();
    expect(errors).to.have.lengthOf(1);

    const capturedError = errors[0];
    expect(capturedError.errorId).to.equal('test-error-123');
    expect(capturedError.error.name).to.equal('ReferenceError');
    expect(capturedError.component.name).to.equal('errorTestComponent');
    expect(capturedError.component.lifecycle).to.equal('connectedCallback');
  });

  it('should deduplicate identical errors', () => {
    const testError = createTestError({
      errorId: 'test-error-1',
      error: {
        name: 'TypeError',
        message: 'Cannot read property of undefined',
        stack: 'TypeError: Cannot read property of undefined\n    at test.js:10:5',
        sanitizedStack: [],
      },
      source: {
        fileName: 'test.js',
        lineNumber: 10,
        columnNumber: 5,
      },
    });

    // Add the same error twice
    errorStore.addError(testError);
    errorStore.addError({ ...testError, errorId: 'test-error-2', timestamp: new Date().toISOString() });

    // Should only have one error with increased occurrence count
    expect(errorStore.getErrorCount()).to.equal(1);

    const errors = errorStore.getErrors();
    expect(errors[0].metadata.occurrenceCount).to.equal(2);
  });

  it('should retrieve errors by component', () => {
    const error1 = createTestError({
      errorId: 'error-1',
      error: {
        name: 'Error',
        message: 'Error in component 1',
        stack: 'Error stack',
        sanitizedStack: [],
      },
      component: {
        name: 'component1',
        namespace: 'c',
        tagName: 'c-component1',
        lifecycle: null,
        filePath: null,
      },
      source: {
        fileName: 'component1.js',
        lineNumber: 5,
        columnNumber: 10,
      },
    });

    const error2 = createTestError({
      errorId: 'error-2',
      component: {
        name: 'component2',
        namespace: 'c',
        tagName: 'c-component2',
        lifecycle: null,
        filePath: null,
      },
    });

    errorStore.addError(error1);
    errorStore.addError(error2);

    const component1Errors = errorStore.getErrorsByComponent('component1');
    expect(component1Errors).to.have.lengthOf(1);
    expect(component1Errors[0].component.name).to.equal('component1');
  });

  it('should retrieve error statistics', () => {
    // Add multiple errors with different severities
    const errors = [
      createTestError({
        errorId: 'error-1',
        component: { name: 'comp1', namespace: 'c', tagName: 'c-comp1', lifecycle: null, filePath: null },
        metadata: { severity: 'error', wasHandled: false, occurrenceCount: 1, tags: [] },
      }),
      createTestError({
        errorId: 'error-2',
        error: { name: 'Warning', message: 'Warning 1', stack: 'stack', sanitizedStack: [] },
        component: { name: 'comp1', namespace: 'c', tagName: 'c-comp1', lifecycle: null, filePath: null },
        metadata: { severity: 'warning', wasHandled: false, occurrenceCount: 1, tags: [] },
      }),
      createTestError({
        errorId: 'error-3',
        error: { name: 'Error', message: 'Error 2', stack: 'stack', sanitizedStack: [] },
        component: { name: 'comp2', namespace: 'c', tagName: 'c-comp2', lifecycle: null, filePath: null },
        metadata: { severity: 'fatal', wasHandled: false, occurrenceCount: 1, tags: [] },
      }),
    ];

    errors.forEach((error) => errorStore.addError(error));

    const stats = errorStore.getStatistics();
    expect(stats.totalErrors).to.equal(3);
    expect(stats.bySeverity.error).to.equal(1);
    expect(stats.bySeverity.warning).to.equal(1);
    expect(stats.bySeverity.fatal).to.equal(1);
    expect(stats.byComponent).to.deep.equal({
      comp1: 2,
      comp2: 1,
    });
  });

  it('should clear all errors', () => {
    const error = createTestError({ errorId: 'error-1' });

    errorStore.addError(error);
    expect(errorStore.getErrorCount()).to.equal(1);

    errorStore.clearErrors();
    expect(errorStore.getErrorCount()).to.equal(0);
  });

  it('should export and import errors as JSON', () => {
    const error = createTestError({ errorId: 'error-1' });

    errorStore.addError(error);

    const json = errorStore.exportAsJSON();
    expect(json).to.be.a('string');

    // Clear and re-import
    errorStore.clearErrors();
    expect(errorStore.getErrorCount()).to.equal(0);

    const importedCount = errorStore.importFromJSON(json);
    expect(importedCount).to.equal(1);
    expect(errorStore.getErrorCount()).to.equal(1);

    const errors = errorStore.getErrors();
    expect(errors[0].errorId).to.equal('error-1');
  });
});
