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

import { TestContext } from '@salesforce/core/testSetup';
import { expect } from 'chai';
import { AuthInfo, Connection } from '@salesforce/core';
import { OrgUtils } from '../../src/shared/orgUtils.js';

describe('orgUtils', () => {
  const $$ = new TestContext();

  afterEach(() => {
    $$.restore();
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
