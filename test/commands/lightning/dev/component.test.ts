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

import { Config as OclifConfig } from '@oclif/core';
import { Config as SfConfig, Messages, Connection, SfProject } from '@salesforce/core';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import { stubSpinner, stubUx } from '@salesforce/sf-plugins-core';
import { expect } from 'chai';
import esmock from 'esmock';
import sinon from 'sinon';
import LightningDevComponent from '../../../../src/commands/lightning/dev/component.js';
import { ComponentUtils } from '../../../../src/shared/componentUtils.js';
import { PreviewUtils } from '../../../../src/shared/previewUtils.js';
import { MetaUtils } from '../../../../src/shared/metaUtils.js';
import { PromptUtils } from '../../../../src/shared/promptUtils.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);

describe('lightning dev component', () => {
  const messages = Messages.loadMessages('@salesforce/plugin-lightning-dev', 'lightning.dev.component');
  const sharedMessages = Messages.loadMessages('@salesforce/plugin-lightning-dev', 'shared.utils');
  const $$ = new TestContext();
  const testOrgData = new MockTestOrgData();
  const testUsername = 'SalesforceDeveloper';
  const testLdpServerId = '1I9xx0000004ClkCAE';
  const testLdpServerToken = 'PFT1vw8v65aXd2b9HFvZ3Zu4OcKZwjI60bq7BEjj5k4=';
  let MockedLightningDevComponent: typeof LightningDevComponent;

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
    Object.defineProperty(Connection.prototype, 'instanceUrl', {
      get: () => 'https://test.salesforce.com',
      configurable: true,
    });
    $$.SANDBOX.stub(SfProject, 'resolve').resolves(SfProject.prototype);
    // Note: resolveProjectPath is already stubbed by TestContext, don't stub it again
    $$.SANDBOX.stub(PreviewUtils, 'initializePreviewConnection').resolves({
      connection: Connection.prototype as unknown as Connection,
      ldpServerId: testLdpServerId,
      ldpServerToken: testLdpServerToken,
    });
    $$.SANDBOX.stub(PreviewUtils, 'getNextAvailablePorts').resolves({ httpPort: 8081, httpsPort: 8082 });
    $$.SANDBOX.stub(PreviewUtils, 'generateWebSocketUrlForLocalDevServer').returns('wss://localhost:8081');
    $$.SANDBOX.stub(PreviewUtils, 'getTargetOrgFromArguments').returns('testOrg');
    $$.SANDBOX.stub(PreviewUtils, 'generateComponentPreviewLaunchArguments').returns([]);
    $$.SANDBOX.stub(PreviewUtils, 'generateComponentPreviewUrl').returns('https://test.salesforce.com/preview');
    stubHandleLocalDevEnablement(undefined);
    // Stub prompt function as safety net to prevent hanging if handleLocalDevEnablement stub is removed
    $$.SANDBOX.stub(PromptUtils, 'promptUserToEnableLocalDev').resolves(true);

    const mockServer = { stopServer: () => {} };
    MockedLightningDevComponent = await esmock<typeof LightningDevComponent>(
      '../../../../src/commands/lightning/dev/component.js',
      {
        '../../../../src/lwc-dev-server/index.js': {
          startLWCServer: () => Promise.resolve(mockServer),
        },
      },
    );
  });

  afterEach(() => {
    $$.restore();
    delete process.env.AUTO_ENABLE_LOCAL_DEV;
  });

  describe('handleLocalDevEnablement', () => {
    it('does not enable when local dev is already enabled', async () => {
      const handleLocalDevStub = stubHandleLocalDevEnablement(undefined);
      $$.SANDBOX.stub(ComponentUtils, 'getNamespacePaths').resolves(['/test/namespace']);
      $$.SANDBOX.stub(ComponentUtils, 'getAllComponentPaths').resolves(['/test/namespace/component1']);
      $$.SANDBOX.stub(ComponentUtils, 'getComponentMetadata').resolves({
        LightningComponentBundle: {
          masterLabel: 'Test Component',
          description: 'Test description',
        },
      });
      $$.SANDBOX.stub(ComponentUtils, 'componentNameToTitleCase').returns('Component1');
      $$.SANDBOX.stub(OclifConfig.prototype, 'runCommand').resolves();
      $$.SANDBOX.stub(PromptUtils, 'promptUserToSelectComponent').resolves('component1');
      process.env.OPEN_BROWSER = 'false';

      const logStub = $$.SANDBOX.stub(MockedLightningDevComponent.prototype, 'log');

      await MockedLightningDevComponent.run(['-o', testOrgData.username]);

      expect(handleLocalDevStub.calledOnce).to.be.true;
      expect(logStub.calledWith(sharedMessages.getMessage('localdev.enabled'))).to.be.false;
      delete process.env.OPEN_BROWSER;
    });

    it('enables local dev when AUTO_ENABLE_LOCAL_DEV is "true"', async () => {
      process.env.AUTO_ENABLE_LOCAL_DEV = 'true';
      process.env.OPEN_BROWSER = 'false';
      restoreHandleLocalDevEnablement();
      // Stub internal methods to verify ensureFirstPartyCookiesNotRequired is called
      $$.SANDBOX.stub(MetaUtils, 'isLightningPreviewEnabled').resolves(false);
      $$.SANDBOX.stub(MetaUtils, 'setLightningPreviewEnabled').resolves();
      const ensureCookiesStub = $$.SANDBOX.stub(MetaUtils, 'ensureFirstPartyCookiesNotRequired').resolves(true);
      $$.SANDBOX.stub(ComponentUtils, 'getNamespacePaths').resolves(['/test/namespace']);
      $$.SANDBOX.stub(ComponentUtils, 'getAllComponentPaths').resolves(['/test/namespace/component1']);
      $$.SANDBOX.stub(ComponentUtils, 'getComponentMetadata').resolves({
        LightningComponentBundle: {
          masterLabel: 'Test Component',
          description: 'Test description',
        },
      });
      $$.SANDBOX.stub(ComponentUtils, 'componentNameToTitleCase').returns('Component1');
      $$.SANDBOX.stub(OclifConfig.prototype, 'runCommand').resolves();
      $$.SANDBOX.stub(PromptUtils, 'promptUserToSelectComponent').resolves('component1');

      const logStub = $$.SANDBOX.stub(MockedLightningDevComponent.prototype, 'log');

      await MockedLightningDevComponent.run(['-o', testOrgData.username]);

      expect(ensureCookiesStub.calledOnce).to.be.true;
      expect(logStub.calledWith(sharedMessages.getMessage('localdev.enabled'))).to.be.true;
      delete process.env.OPEN_BROWSER;
    });

    it('does not enable when AUTO_ENABLE_LOCAL_DEV is "false"', async () => {
      process.env.AUTO_ENABLE_LOCAL_DEV = 'false';
      process.env.OPEN_BROWSER = 'false';
      restoreHandleLocalDevEnablement();
      const handleLocalDevStub = $$.SANDBOX.stub(MetaUtils, 'handleLocalDevEnablement').rejects(
        new Error(sharedMessages.getMessage('error.localdev.not.enabled')),
      );
      $$.SANDBOX.stub(ComponentUtils, 'getNamespacePaths').resolves(['/test/namespace']);
      $$.SANDBOX.stub(ComponentUtils, 'getAllComponentPaths').resolves(['/test/namespace/component1']);
      $$.SANDBOX.stub(ComponentUtils, 'getComponentMetadata').resolves({
        LightningComponentBundle: {
          masterLabel: 'Test Component',
          description: 'Test description',
        },
      });
      $$.SANDBOX.stub(ComponentUtils, 'componentNameToTitleCase').returns('Component1');
      $$.SANDBOX.stub(OclifConfig.prototype, 'runCommand').resolves();
      $$.SANDBOX.stub(PromptUtils, 'promptUserToSelectComponent').resolves('component1');

      const logStub = $$.SANDBOX.stub(MockedLightningDevComponent.prototype, 'log');

      try {
        await MockedLightningDevComponent.run(['-o', testOrgData.username]);
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err).to.be.an('error').with.property('message', sharedMessages.getMessage('error.localdev.not.enabled'));
      }

      expect(handleLocalDevStub.calledOnce).to.be.true;
      expect(logStub.calledWith(sharedMessages.getMessage('localdev.enabled'))).to.be.false;
      delete process.env.OPEN_BROWSER;
    });

    it('prompts user and enables when AUTO_ENABLE_LOCAL_DEV is undefined and user accepts', async () => {
      delete process.env.AUTO_ENABLE_LOCAL_DEV;
      process.env.OPEN_BROWSER = 'false';
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
      $$.SANDBOX.stub(ComponentUtils, 'getNamespacePaths').resolves(['/test/namespace']);
      $$.SANDBOX.stub(ComponentUtils, 'getAllComponentPaths').resolves(['/test/namespace/component1']);
      $$.SANDBOX.stub(ComponentUtils, 'getComponentMetadata').resolves({
        LightningComponentBundle: {
          masterLabel: 'Test Component',
          description: 'Test description',
        },
      });
      $$.SANDBOX.stub(ComponentUtils, 'componentNameToTitleCase').returns('Component1');
      $$.SANDBOX.stub(OclifConfig.prototype, 'runCommand').resolves();
      $$.SANDBOX.stub(PromptUtils, 'promptUserToSelectComponent').resolves('component1');

      const logStub = $$.SANDBOX.stub(MockedLightningDevComponent.prototype, 'log');

      await MockedLightningDevComponent.run(['-o', testOrgData.username]);

      // ensureFirstPartyCookiesNotRequired should NOT be called when AUTO_ENABLE_LOCAL_DEV is undefined
      expect(ensureCookiesStub.called).to.be.false;
      expect(logStub.calledWith(sharedMessages.getMessage('localdev.enabled'))).to.be.true;
      delete process.env.OPEN_BROWSER;
    });

    it('handles error when enabling local dev fails', async () => {
      process.env.OPEN_BROWSER = 'false';
      restoreHandleLocalDevEnablement();
      const handleLocalDevStub = $$.SANDBOX.stub(MetaUtils, 'handleLocalDevEnablement').rejects(
        new Error('Enable failed'),
      );
      $$.SANDBOX.stub(ComponentUtils, 'getNamespacePaths').resolves(['/test/namespace']);
      $$.SANDBOX.stub(ComponentUtils, 'getAllComponentPaths').resolves(['/test/namespace/component1']);
      $$.SANDBOX.stub(ComponentUtils, 'getComponentMetadata').resolves({
        LightningComponentBundle: {
          masterLabel: 'Test Component',
          description: 'Test description',
        },
      });
      $$.SANDBOX.stub(ComponentUtils, 'componentNameToTitleCase').returns('Component1');
      $$.SANDBOX.stub(OclifConfig.prototype, 'runCommand').resolves();
      $$.SANDBOX.stub(PromptUtils, 'promptUserToSelectComponent').resolves('component1');

      try {
        await MockedLightningDevComponent.run(['-o', testOrgData.username]);
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err).to.be.an('error').with.property('message', 'Enable failed');
      }

      expect(handleLocalDevStub.calledOnce).to.be.true;
      delete process.env.OPEN_BROWSER;
    });
  });

  describe('component selection', () => {
    it('throws when component directory is not found', async () => {
      process.env.AUTO_ENABLE_LOCAL_DEV = 'true';
      stubHandleLocalDevEnablement(undefined);
      $$.SANDBOX.stub(ComponentUtils, 'getNamespacePaths').resolves([]);
      $$.SANDBOX.stub(ComponentUtils, 'getAllComponentPaths').resolves(undefined);

      try {
        await MockedLightningDevComponent.run(['-o', testOrgData.username]);
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err).to.be.an('error').with.property('message', messages.getMessage('error.directory'));
      }
      delete process.env.AUTO_ENABLE_LOCAL_DEV;
    });

    it('resolves lightning type json path to component name', async () => {
      process.env.OPEN_BROWSER = 'false';
      stubHandleLocalDevEnablement(undefined);
      const lightningTypePath = '/force-app/main/default/lightningTypes/ExampleType/exampleBundle/renderer.json';
      const resolveStub = $$.SANDBOX.stub(ComponentUtils, 'getComponentNameFromLightningTypeJson').resolves(
        'component1',
      );
      $$.SANDBOX.stub(ComponentUtils, 'getNamespacePaths').resolves(['/test/namespace']);
      $$.SANDBOX.stub(ComponentUtils, 'getAllComponentPaths').resolves(['/test/namespace/component1']);
      $$.SANDBOX.stub(ComponentUtils, 'getComponentMetadata').resolves({
        LightningComponentBundle: {
          masterLabel: 'Test Component',
          description: 'Test description',
        },
      });
      $$.SANDBOX.stub(ComponentUtils, 'componentNameToTitleCase').returns('Component1');
      $$.SANDBOX.stub(OclifConfig.prototype, 'runCommand').resolves();

      await MockedLightningDevComponent.run(['-n', lightningTypePath, '-o', testOrgData.username]);

      expect(resolveStub.calledOnceWith(lightningTypePath)).to.be.true;
      delete process.env.OPEN_BROWSER;
    });

    it('skips preview when lightning type json has no override', async () => {
      process.env.OPEN_BROWSER = 'false';
      stubHandleLocalDevEnablement(undefined);
      const lightningTypePath = '/force-app/main/default/lightningTypes/ExampleType/exampleBundle/editor.json';
      $$.SANDBOX.stub(ComponentUtils, 'getComponentNameFromLightningTypeJson').resolves(null);

      const result = await MockedLightningDevComponent.run(['-n', lightningTypePath, '-o', testOrgData.username]);

      expect(result).to.include({
        ldpServerUrl: '',
        ldpServerId: '',
        componentName: '',
        previewUrl: '',
      });
      expect(result.instanceUrl).to.match(/^https?:\/\//);
      delete process.env.OPEN_BROWSER;
    });

    it('prompts user to select component when name is not provided', async () => {
      process.env.OPEN_BROWSER = 'false';
      // Ensure handleLocalDevEnablement is stubbed (already stubbed in beforeEach, but ensure it's still active)
      restoreHandleLocalDevEnablement();
      stubHandleLocalDevEnablement(undefined);
      $$.SANDBOX.stub(ComponentUtils, 'getNamespacePaths').resolves(['/test/namespace']);
      $$.SANDBOX.stub(ComponentUtils, 'getAllComponentPaths').resolves(['/test/namespace/component1']);
      $$.SANDBOX.stub(ComponentUtils, 'getComponentMetadata').resolves({
        LightningComponentBundle: {
          masterLabel: 'Test Component',
          description: 'Test description',
        },
      });
      $$.SANDBOX.stub(ComponentUtils, 'componentNameToTitleCase').returns('Component1');
      $$.SANDBOX.stub(OclifConfig.prototype, 'runCommand').resolves();
      const promptStub = $$.SANDBOX.stub(PromptUtils, 'promptUserToSelectComponent').resolves('component1');

      await MockedLightningDevComponent.run(['-o', testOrgData.username]);

      expect(promptStub.calledOnce).to.be.true;
      delete process.env.OPEN_BROWSER;
    });

    it('validates component exists when name is provided', async () => {
      process.env.OPEN_BROWSER = 'false';
      stubHandleLocalDevEnablement(undefined);
      $$.SANDBOX.stub(ComponentUtils, 'getNamespacePaths').resolves(['/test/namespace']);
      $$.SANDBOX.stub(ComponentUtils, 'getAllComponentPaths').resolves(['/test/namespace/component1']);
      $$.SANDBOX.stub(ComponentUtils, 'getComponentMetadata').resolves({
        LightningComponentBundle: {
          masterLabel: 'Test Component',
          description: 'Test description',
        },
      });
      $$.SANDBOX.stub(ComponentUtils, 'componentNameToTitleCase').returns('Component1');
      $$.SANDBOX.stub(OclifConfig.prototype, 'runCommand').resolves();

      await MockedLightningDevComponent.run(['-n', 'component1', '-o', testOrgData.username]);
      delete process.env.OPEN_BROWSER;
    });

    it('throws when specified component is not found', async () => {
      stubHandleLocalDevEnablement(undefined);
      $$.SANDBOX.stub(ComponentUtils, 'getNamespacePaths').resolves(['/test/namespace']);
      $$.SANDBOX.stub(ComponentUtils, 'getAllComponentPaths').resolves(['/test/namespace/component1']);
      $$.SANDBOX.stub(ComponentUtils, 'getComponentMetadata').resolves({
        LightningComponentBundle: {
          masterLabel: 'Test Component',
          description: 'Test description',
        },
      });
      $$.SANDBOX.stub(ComponentUtils, 'componentNameToTitleCase').returns('Component1');

      try {
        await MockedLightningDevComponent.run(['-n', 'nonexistent', '-o', testOrgData.username]);
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err)
          .to.be.an('error')
          .with.property('message', messages.getMessage('error.component-not-found', ['nonexistent']));
      }
    });
  });

  describe('client-select flag', () => {
    it('skips component selection when --client-select is provided', async () => {
      stubHandleLocalDevEnablement(undefined);
      const getNamespacePathsStub = $$.SANDBOX.stub(ComponentUtils, 'getNamespacePaths').resolves([]);
      $$.SANDBOX.stub(OclifConfig.prototype, 'runCommand').resolves();
      process.env.OPEN_BROWSER = 'false';

      await MockedLightningDevComponent.run(['--client-select', '-o', testOrgData.username]);

      expect(getNamespacePathsStub.called).to.be.false;
      delete process.env.OPEN_BROWSER;
    });
  });
});
