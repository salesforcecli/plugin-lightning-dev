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
import { AuthInfo, Connection } from '@salesforce/core';
import { CommonUtils } from '@salesforce/lwc-dev-mobile-core';
import { OrgUtils } from '../../src/shared/orgUtils.js';
import { VersionResolver } from '../../src/shared/versionResolver.js';

describe('orgUtils', () => {
  const $$ = new TestContext();

  const mockPackageJson = {
    apiVersionMetadata: {
      channels: {
        latest: {
          supportedApiVersions: ['65.0'],
          dependencies: {},
        },
        prerelease: {
          supportedApiVersions: ['66.0'],
          dependencies: {},
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

  describe('getVersionChannel', () => {
    it('returns override channel if provided', async () => {
      const conn = new Connection({ authInfo: new AuthInfo() });
      const channel = OrgUtils.getVersionChannel(conn, 'prerelease');
      expect(channel).to.equal('prerelease');
    });

    it('returns channel from FORCE_VERSION_CHANNEL env var', async () => {
      process.env.FORCE_VERSION_CHANNEL = 'prerelease';
      const conn = new Connection({ authInfo: new AuthInfo() });
      const channel = OrgUtils.getVersionChannel(conn);
      expect(channel).to.equal('prerelease');
      delete process.env.FORCE_VERSION_CHANNEL;
    });

    it('throws error for invalid FORCE_VERSION_CHANNEL', async () => {
      process.env.FORCE_VERSION_CHANNEL = 'invalid';
      const conn = new Connection({ authInfo: new AuthInfo() });
      expect(() => OrgUtils.getVersionChannel(conn)).to.throw(/Invalid FORCE_VERSION_CHANNEL/);
      delete process.env.FORCE_VERSION_CHANNEL;
    });

    it('returns default channel when SKIP_API_VERSION_CHECK is true', async () => {
      process.env.SKIP_API_VERSION_CHECK = 'true';
      const conn = new Connection({ authInfo: new AuthInfo() });
      const channel = OrgUtils.getVersionChannel(conn);
      expect(channel).to.equal('latest');
      delete process.env.SKIP_API_VERSION_CHECK;
    });

    it('auto-detects channel based on org version', async () => {
      const conn = new Connection({ authInfo: new AuthInfo() });
      $$.SANDBOX.stub(conn, 'version').get(() => '65.0');
      $$.SANDBOX.stub(conn, 'getAuthInfoFields').returns({ orgId: 'org1' });

      const channel = OrgUtils.getVersionChannel(conn);
      expect(channel).to.equal('latest');
    });

    it('throws error for unsupported org version', async () => {
      const conn = new Connection({ authInfo: new AuthInfo() });
      $$.SANDBOX.stub(conn, 'version').get(() => '64.0');
      $$.SANDBOX.stub(conn, 'getAuthInfoFields').returns({ orgId: 'org1' });

      expect(() => OrgUtils.getVersionChannel(conn)).to.throw(/Unsupported org API version: 64.0/);
    });
  });

  it('getAppDefinitionDurableId returns undefined when no matches found', async () => {
    $$.SANDBOX.stub(Connection.prototype, 'query').resolves({ records: [], done: true, totalSize: 0 });
    const appId = await OrgUtils.getAppDefinitionDurableId(new Connection({ authInfo: new AuthInfo() }), 'blah');
    expect(appId).to.be.undefined;
  });

  it('getAppDefinitionDurableId returns first match when multiple matches found', async () => {
    $$.SANDBOX.stub(Connection.prototype, 'query').resolves({
      records: [{ DurableId: 'id1' }, { DurableId: 'id2' }],
      done: true,
      totalSize: 2,
    });
    const appId = await OrgUtils.getAppDefinitionDurableId(new Connection({ authInfo: new AuthInfo() }), 'Sales');
    expect(appId).to.be.equal('id1');
  });

  it('getAppDefinitionDurableId uses Label if DeveloperName produces no matches', async () => {
    const noMatches = { records: [], done: true, totalSize: 0 };
    const matches = { records: [{ DurableId: 'id1' }, { DurableId: 'id2' }], done: true, totalSize: 2 };
    const stub = $$.SANDBOX.stub(Connection.prototype, 'query')
      .onFirstCall()
      .resolves(noMatches)
      .onSecondCall()
      .resolves(matches);
    const appId = await OrgUtils.getAppDefinitionDurableId(new Connection({ authInfo: new AuthInfo() }), 'Sales');
    expect(appId).to.be.equal('id1');
    expect(stub.getCall(0).args[0]).to.include('DeveloperName');
    expect(stub.getCall(1).args[0]).to.include('Label');
  });
});
