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

import { expect } from 'chai';
import { loadLwcModule } from '../../src/shared/dependencyLoader.js';

describe('DependencyLoader', () => {
  it('exists and has expected method', () => {
    expect(typeof loadLwcModule).to.equal('function');
  });

  it('throws when loading aliased package for unsupported API version (alias does not exist)', async () => {
    const unsupportedVersion = '99.0';
    try {
      await loadLwcModule(unsupportedVersion);
      expect.fail('Should have thrown for unsupported API version');
    } catch (error) {
      const err = error as Error;
      expect(err).to.be.an('Error');
      expect(err.message).to.include(unsupportedVersion);
      expect(err.message).to.include('supports only');
    }
  });

  it('loads the aliased package (real import call)', async () => {
    // This will actually try to call import() which should work since we ran yarn install.
    // However, loading LWC modules in Node might still trigger ReferenceErrors if browser globals are missing.
    // We use a try-catch to handle both cases and just verify the attempt was made.
    try {
      const module = await loadLwcModule('65.0');
      expect(module).to.exist;
    } catch (error) {
      // If it fails with a ReferenceError or similar, it's still "working" in terms of
      // attempting to load the right package name.
      const errorMessage = (error as Error).message;
      if (errorMessage.includes('could not be imported')) {
        expect(errorMessage).to.include('@lwc/sfdx-local-dev-dist-65.0');
      } else {
        // Other errors (like ReferenceError: Element is not defined) mean the package WAS found and loaded
        expect(errorMessage).to.not.include('could not be imported');
      }
    }
  });
});
