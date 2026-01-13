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
import { resolveChannel, getDefaultChannel } from '../../src/shared/versionResolver.js';

describe('VersionResolver', () => {
  it('resolveChannel returns correct channel for exact match', () => {
    expect(resolveChannel('65.0')).to.equal('latest');
    expect(resolveChannel('66.0')).to.equal('prerelease');
    expect(resolveChannel('67.0')).to.equal('next');
  });

  it('resolveChannel returns correct channel for major.minor match', () => {
    expect(resolveChannel('65.0.1')).to.equal('latest');
    expect(resolveChannel('66.0.5')).to.equal('prerelease');
    expect(resolveChannel('67.0.2')).to.equal('next');
  });

  it('resolveChannel throws error for unsupported version', () => {
    expect(() => resolveChannel('64.0')).to.throw(/Unsupported org API version: 64.0/);
  });

  it('getDefaultChannel returns default from package.json', () => {
    expect(getDefaultChannel()).to.equal('latest');
  });
});
