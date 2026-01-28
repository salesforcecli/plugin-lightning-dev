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

import { Config as SfConfig, Messages, Connection } from '@salesforce/core';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import { stubSpinner, stubUx } from '@salesforce/sf-plugins-core';
import { expect } from 'chai';
import esmock from 'esmock';
import sinon from 'sinon';
import LightningDevSite from '../../../../src/commands/lightning/dev/site.js';
import { OrgUtils } from '../../../../src/shared/orgUtils.js';
import { ExperienceSite } from '../../../../src/shared/experience/expSite.js';
import { MetaUtils } from '../../../../src/shared/metaUtils.js';
import { PreviewUtils } from '../../../../src/shared/previewUtils.js';
import { PromptUtils } from '../../../../src/shared/promptUtils.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);

describe('lightning dev site', () => {
  const sharedMessages = Messages.loadMessages('@salesforce/plugin-lightning-dev', 'shared.utils');
  const $$ = new TestContext();
  const testOrgData = new MockTestOrgData();
  const testUsername = 'SalesforceDeveloper';
  let MockedLightningDevSite: typeof LightningDevSite;

  // Helper function to safely stub handleLocalDevEnablement (restores if already stubbed)
  const stubHandleLocalDevEnablement = (returnValue?: boolean | undefined): sinon.SinonStub => {
    // Restore if already stubbed - use try/catch to handle case where it's not stubbed
    /* eslint-disable @typescript-eslint/unbound-method */
    try {
      const existingStub = MetaUtils.handleLocalDevEnablement as unknown as sinon.SinonStub;
      if (existingStub && typeof existingStub.restore === 'function') {
        existingStub.restore();
      }
    } catch {
      // Not stubbed, continue
    }
    /* eslint-enable @typescript-eslint/unbound-method */
    // Stub with the desired return value
    if (returnValue === undefined) {
      return $$.SANDBOX.stub(MetaUtils, 'handleLocalDevEnablement').resolves(undefined);
    }
    return $$.SANDBOX.stub(MetaUtils, 'handleLocalDevEnablement').resolves(returnValue);
  };

  // Helper to restore handleLocalDevEnablement stub (for cases where we need to stub with rejects)
  const restoreHandleLocalDevEnablement = (): void => {
    /* eslint-disable @typescript-eslint/unbound-method */
    try {
      const existingStub = MetaUtils.handleLocalDevEnablement as unknown as sinon.SinonStub;
      if (existingStub && typeof existingStub.restore === 'function') {
        existingStub.restore();
      }
    } catch {
      // Not stubbed, continue
    }
    /* eslint-enable @typescript-eslint/unbound-method */
  };

  beforeEach(async () => {
    // Set environment variable early to skip prompts
    process.env.AUTO_ENABLE_LOCAL_DEV = 'true';
    stubUx($$.SANDBOX);
    stubSpinner($$.SANDBOX);
    await $$.stubAuths(testOrgData);

    $$.SANDBOX.stub(SfConfig, 'create').withArgs($$.SANDBOX.match.any).resolves(SfConfig.prototype);
    $$.SANDBOX.stub(SfConfig, 'addAllowedProperties').withArgs($$.SANDBOX.match.any);
    $$.SANDBOX.stub(SfConfig.prototype, 'get').returns(undefined);
    $$.SANDBOX.stub(SfConfig.prototype, 'set');
    $$.SANDBOX.stub(SfConfig.prototype, 'write').resolves();
    $$.SANDBOX.stub(Connection.prototype, 'getUsername').returns(testUsername);
    $$.SANDBOX.stub(OrgUtils, 'ensureMatchingAPIVersion').returns();
    $$.SANDBOX.stub(ExperienceSite, 'getAllExpSites').resolves(['TestSite']);
    $$.SANDBOX.stub(ExperienceSite.prototype, 'getPreviewUrl').resolves('https://test.salesforce.com/sites/TestSite');
    $$.SANDBOX.stub(ExperienceSite.prototype, 'isSiteSetup').resolves(true);
    $$.SANDBOX.stub(ExperienceSite.prototype, 'getSiteDirectory').returns('/test/site/dir');
    $$.SANDBOX.stub(MetaUtils, 'handleLocalDevEnablement').resolves(undefined);
    // Stub prompt function as safety net to prevent hanging if handleLocalDevEnablement stub is removed
    $$.SANDBOX.stub(PromptUtils, 'promptUserToEnableLocalDev').resolves(true);
    $$.SANDBOX.stub(PreviewUtils, 'getOrCreateAppServerIdentity').resolves({
      identityToken: 'test-token',
      usernameToServerEntityIdMap: { [testUsername]: 'test-server-id' },
    });
    $$.SANDBOX.stub(PreviewUtils, 'getNextAvailablePorts').resolves({ httpPort: 8081, httpsPort: 8082 });
    $$.SANDBOX.stub(PreviewUtils, 'generateWebSocketUrlForLocalDevServer').returns('wss://localhost:8081');

    MockedLightningDevSite = await esmock<typeof LightningDevSite>('../../../../src/commands/lightning/dev/site.js', {
      '../../../../src/lwc-dev-server/index.js': {
        startLWCServer: async () => ({ stopServer: () => {} }),
      },
      open: async () => {},
    });
  });

  afterEach(() => {
    $$.restore();
    delete process.env.AUTO_ENABLE_LOCAL_DEV;
  });

  describe('handleLocalDevEnablement', () => {
    it('does not enable when local dev is already enabled', async () => {
      const handleLocalDevStub = stubHandleLocalDevEnablement(undefined);

      const logStub = $$.SANDBOX.stub(MockedLightningDevSite.prototype, 'log');

      await MockedLightningDevSite.run(['-o', testOrgData.username, '-n', 'TestSite']);

      expect(handleLocalDevStub.calledOnce).to.be.true;
      expect(logStub.calledWith(sharedMessages.getMessage('localdev.enabled'))).to.be.false;
    });

    it('enables local dev when AUTO_ENABLE_LOCAL_DEV is "true"', async () => {
      process.env.AUTO_ENABLE_LOCAL_DEV = 'true';
      restoreHandleLocalDevEnablement();
      // Stub internal methods to verify ensureFirstPartyCookiesNotRequired is called
      $$.SANDBOX.stub(MetaUtils, 'isLightningPreviewEnabled').resolves(false);
      $$.SANDBOX.stub(MetaUtils, 'setLightningPreviewEnabled').resolves();
      const ensureCookiesStub = $$.SANDBOX.stub(MetaUtils, 'ensureFirstPartyCookiesNotRequired').resolves(true);

      const logStub = $$.SANDBOX.stub(MockedLightningDevSite.prototype, 'log');

      await MockedLightningDevSite.run(['-o', testOrgData.username, '-n', 'TestSite']);

      expect(ensureCookiesStub.calledOnce).to.be.true;
      expect(logStub.calledWith(sharedMessages.getMessage('localdev.enabled'))).to.be.true;
    });

    it('does not enable when AUTO_ENABLE_LOCAL_DEV is "false"', async () => {
      process.env.AUTO_ENABLE_LOCAL_DEV = 'false';
      restoreHandleLocalDevEnablement();
      const handleLocalDevStub = $$.SANDBOX.stub(MetaUtils, 'handleLocalDevEnablement').rejects(
        new Error(sharedMessages.getMessage('error.localdev.not.enabled')),
      );

      const logStub = $$.SANDBOX.stub(MockedLightningDevSite.prototype, 'log');

      await MockedLightningDevSite.run(['-o', testOrgData.username, '-n', 'TestSite']);

      expect(handleLocalDevStub.calledOnce).to.be.true;
      expect(logStub.calledWith(sharedMessages.getMessage('localdev.enabled'))).to.be.false;
      // Site command catches errors and logs them
      expect(logStub.calledWith('Local Development setup failed', $$.SANDBOX.match.any)).to.be.true;
    });

    it('prompts user and enables when AUTO_ENABLE_LOCAL_DEV is undefined and user accepts', async () => {
      delete process.env.AUTO_ENABLE_LOCAL_DEV;
      restoreHandleLocalDevEnablement();
      // Restore promptUserToEnableLocalDev if it was stubbed in beforeEach
      try {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        const existingPromptStub = PromptUtils.promptUserToEnableLocalDev as unknown as sinon.SinonStub;
        if (existingPromptStub && typeof existingPromptStub.restore === 'function') {
          // eslint-disable-next-line @typescript-eslint/unbound-method
          existingPromptStub.restore();
        }
      } catch {
        // Not stubbed, continue
      }
      // Stub internal methods to verify ensureFirstPartyCookiesNotRequired is NOT called when AUTO_ENABLE_LOCAL_DEV is undefined
      $$.SANDBOX.stub(MetaUtils, 'isLightningPreviewEnabled').resolves(false);
      $$.SANDBOX.stub(MetaUtils, 'setLightningPreviewEnabled').resolves();
      const ensureCookiesStub = $$.SANDBOX.stub(MetaUtils, 'ensureFirstPartyCookiesNotRequired').resolves(true);
      $$.SANDBOX.stub(PromptUtils, 'promptUserToEnableLocalDev').resolves(true);

      const logStub = $$.SANDBOX.stub(MockedLightningDevSite.prototype, 'log');

      await MockedLightningDevSite.run(['-o', testOrgData.username, '-n', 'TestSite']);

      // ensureFirstPartyCookiesNotRequired should NOT be called when AUTO_ENABLE_LOCAL_DEV is undefined
      expect(ensureCookiesStub.called).to.be.false;
      expect(logStub.calledWith(sharedMessages.getMessage('localdev.enabled'))).to.be.true;
    });

    it('handles error when enabling local dev fails', async () => {
      restoreHandleLocalDevEnablement();
      const handleLocalDevStub = $$.SANDBOX.stub(MetaUtils, 'handleLocalDevEnablement').rejects(
        new Error('Enable failed'),
      );

      const logStub = $$.SANDBOX.stub(MockedLightningDevSite.prototype, 'log');

      await MockedLightningDevSite.run(['-o', testOrgData.username, '-n', 'TestSite']);

      expect(handleLocalDevStub.calledOnce).to.be.true;
      // Site command catches errors and logs them with generic message
      expect(logStub.calledWith('Local Development setup failed', $$.SANDBOX.match.any)).to.be.true;
    });
  });
});
