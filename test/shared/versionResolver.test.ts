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

import { TestContext } from '@salesforce/core/testSetup';
import { expect } from 'chai';
import { CommonUtils } from '@salesforce/lwc-dev-mobile-core';
import { VersionResolver } from '../../src/shared/versionResolver.js';

describe('VersionResolver', () => {
  const $$ = new TestContext();

  const mockPackageJson = {
    apiVersionMetadata: {
      channels: {
        latest: {
          supportedApiVersions: ['65.0'],
          dependencies: {
            '@lwc/lwc-dev-server': '~13.2.x',
            lwc: '~8.23.x',
          },
        },
        prerelease: {
          supportedApiVersions: ['66.0'],
          dependencies: {
            '@lwc/lwc-dev-server': '~13.3.x',
            lwc: '~8.24.x',
          },
        },
        next: {
          supportedApiVersions: ['67.0'],
          dependencies: {
            '@lwc/lwc-dev-server': '~13.3.x',
            lwc: '~8.24.x',
          },
        },
      },
      defaultChannel: 'latest',
    },
  };

  beforeEach(() => {
    $$.SANDBOX.stub(CommonUtils, 'loadJsonFromFile').returns(mockPackageJson);
    VersionResolver.clearCache();
  });

  afterEach(() => {
    $$.restore();
  });

  it('resolveChannel returns correct channel for exact match', () => {
    expect(VersionResolver.resolveChannel('65.0')).to.equal('latest');
    expect(VersionResolver.resolveChannel('66.0')).to.equal('prerelease');
    expect(VersionResolver.resolveChannel('67.0')).to.equal('next');
  });

  it('resolveChannel returns correct channel for major.minor match', () => {
    expect(VersionResolver.resolveChannel('65.0.1')).to.equal('latest');
    expect(VersionResolver.resolveChannel('66.0.5')).to.equal('prerelease');
    expect(VersionResolver.resolveChannel('67.0.2')).to.equal('next');
  });

  it('resolveChannel throws error for unsupported version', () => {
    expect(() => VersionResolver.resolveChannel('64.0')).to.throw(/Unsupported org API version: 64.0/);
  });

  it('resolveChannelWithCache returns cached value', () => {
    const resolveSpy = $$.SANDBOX.spy(VersionResolver, 'resolveChannel');

    // First call - resolves
    const channel1 = VersionResolver.resolveChannelWithCache('org1', '65.0');
    expect(channel1).to.equal('latest');
    expect(resolveSpy.calledOnce).to.be.true;

    // Second call - cached
    const channel2 = VersionResolver.resolveChannelWithCache('org1', '65.0');
    expect(channel2).to.equal('latest');
    expect(resolveSpy.calledOnce).to.be.true;

    // Different org - resolves
    const channel3 = VersionResolver.resolveChannelWithCache('org2', '65.0');
    expect(channel3).to.equal('latest');
    expect(resolveSpy.calledTwice).to.be.true;
  });

  it('resolveChannelWithCache invalidates cache when version changes', () => {
    VersionResolver.resolveChannelWithCache('org1', '65.0');

    const resolveSpy = $$.SANDBOX.spy(VersionResolver, 'resolveChannel');

    // Version changed - re-resolves
    const channel = VersionResolver.resolveChannelWithCache('org1', '66.0');
    expect(channel).to.equal('prerelease');
    expect(resolveSpy.calledOnce).to.be.true;
  });

  it('getDefaultChannel returns default from package.json', () => {
    expect(VersionResolver.getDefaultChannel()).to.equal('latest');
  });
});
