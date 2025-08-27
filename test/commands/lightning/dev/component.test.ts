/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Config as OclifConfig } from '@oclif/core';
import { Messages, Connection } from '@salesforce/core';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import { stubUx } from '@salesforce/sf-plugins-core';
import { expect } from 'chai';
import esmock from 'esmock';
import LightningDevComponent from '../../../../src/commands/lightning/dev/component.js';
import { PreviewUtils } from '../../../../src/shared/previewUtils.js';
import { ConfigUtils, LocalWebServerIdentityData } from '../../../../src/shared/configUtils.js';
import { ComponentUtils } from '../../../../src/shared/componentUtils.js';
import { OrgUtils } from '../../../../src/shared/orgUtils.js';
import { PromptUtils } from '../../../../src/shared/promptUtils.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);

const messages = Messages.loadMessages('@salesforce/plugin-lightning-dev', 'lightning.dev.component');
const sharedMessages = Messages.loadMessages('@salesforce/plugin-lightning-dev', 'shared.utils');

const testOrgData = new MockTestOrgData();

const testUsername = 'SalesforceDeveloper';
const testLdpServerId = '1I9xx0000004ClkCAE';
const testLdpServerToken = 'PFT1vw8v65aXd2b9HFvZ3Zu4OcKZwjI60bq7BEjj5k4=';
const testLdpServerUrl = 'wss://localhost:1234';
const testIdentityData: LocalWebServerIdentityData = {
  identityToken: testLdpServerToken,
  usernameToServerEntityIdMap: {},
};

testIdentityData.usernameToServerEntityIdMap[testUsername] = testLdpServerId;

describe('lightning single component preview', () => {
  const $$ = new TestContext();
  let MockedLightningDevComponent: typeof LightningDevComponent;

  beforeEach(async () => {
    stubUx($$.SANDBOX);
    await $$.stubAuths(testOrgData);

    $$.SANDBOX.stub(Connection.prototype, 'getUsername').returns(testUsername);
    $$.SANDBOX.stub(OrgUtils, 'isLocalDevEnabled').resolves(true);
    $$.SANDBOX.stub(OrgUtils, 'ensureMatchingAPIVersion').returns();
    $$.SANDBOX.stub(PreviewUtils, 'getOrCreateAppServerIdentity').resolves(testIdentityData);
    $$.SANDBOX.stub(PreviewUtils, 'initializePreviewConnection').resolves({
      ldpServerId: testLdpServerId,
      ldpServerToken: testLdpServerToken,
      connection: {} as Connection,
    });
    $$.SANDBOX.stub(PreviewUtils, 'generateWebSocketUrlForLocalDevServer').returns(testLdpServerUrl);
    $$.SANDBOX.stub(PreviewUtils, 'getNextAvailablePorts').resolves({ httpPort: 8081, httpsPort: 8082 });
    $$.SANDBOX.stub(ConfigUtils, 'getIdentityData').resolves(testIdentityData);
    $$.SANDBOX.stub(ComponentUtils, 'getNamespacePaths').resolves(['/mock/path']);
    $$.SANDBOX.stub(ComponentUtils, 'getAllComponentPaths').resolves(['/mock/component/testComponent']);
    $$.SANDBOX.stub(ComponentUtils, 'getComponentMetadata').resolves({
      LightningComponentBundle: {
        masterLabel: 'Test Component',
        description: 'Test component description',
      },
    });
    $$.SANDBOX.stub(ComponentUtils, 'componentNameToTitleCase').returns('Test Component');

    MockedLightningDevComponent = await esmock<typeof LightningDevComponent>(
      '../../../../src/commands/lightning/dev/component.js',
      {
        '../../../../src/lwc-dev-server/index.js': {
          startLWCServer: async () => ({ stopServer: () => {} }),
        },
      }
    );
  });

  afterEach(() => {
    $$.restore();
  });

  it('throws when local dev not enabled', async () => {
    try {
      $$.SANDBOX.restore();
      $$.SANDBOX.stub(OrgUtils, 'isLocalDevEnabled').resolves(false);
      await LightningDevComponent.run(['--name', 'testComponent', '--target-org', testOrgData.orgId]);
    } catch (err) {
      expect(err).to.be.an('error').with.property('message', sharedMessages.getMessage('error.localdev.not.enabled'));
    }
  });

  it('throws when username not found', async () => {
    try {
      $$.SANDBOX.restore();
      $$.SANDBOX.stub(OrgUtils, 'isLocalDevEnabled').resolves(true);
      $$.SANDBOX.stub(Connection.prototype, 'getUsername').returns(undefined);
      await LightningDevComponent.run(['--name', 'testComponent', '--target-org', testOrgData.orgId]);
    } catch (err) {
      expect(err).to.be.an('error').with.property('message', sharedMessages.getMessage('error.username'));
    }
  });

  it('should include ldpServerId in preview URL', async () => {
    const runCmdStub = $$.SANDBOX.stub(OclifConfig.prototype, 'runCommand').resolves();

    await MockedLightningDevComponent.run(['--name', 'testComponent', '--target-org', testOrgData.orgId]);

    expect(runCmdStub.calledOnce).to.be.true;
    const [command, args] = runCmdStub.getCall(0).args;
    expect(command).to.equal('org:open');
    expect(args).to.be.an('array');
    expect(args).to.have.length.greaterThan(1);
    expect(args![1]).to.include(`ldpServerId=${testLdpServerId}`);
  });

  it('should include ldpServerUrl in preview URL', async () => {
    const runCmdStub = $$.SANDBOX.stub(OclifConfig.prototype, 'runCommand').resolves();

    await MockedLightningDevComponent.run(['--name', 'testComponent', '--target-org', testOrgData.orgId]);

    expect(runCmdStub.calledOnce).to.be.true;
    const [command, args] = runCmdStub.getCall(0).args;
    expect(command).to.equal('org:open');
    expect(args).to.be.an('array');
    expect(args).to.have.length.greaterThan(1);
    expect(args![1]).to.include(`ldpServerUrl=${testLdpServerUrl}`);
  });

  it('should include both ldpServerId and ldpServerUrl in preview URL when client-select flag is used', async () => {
    const runCmdStub = $$.SANDBOX.stub(OclifConfig.prototype, 'runCommand').resolves();

    await MockedLightningDevComponent.run(['--client-select', '--target-org', testOrgData.orgId]);

    expect(runCmdStub.calledOnce).to.be.true;
    const [command, args] = runCmdStub.getCall(0).args;
    expect(command).to.equal('org:open');
    expect(args).to.be.an('array');
    expect(args).to.have.length.greaterThan(1);
    expect(args![1]).to.include(`ldpServerId=${testLdpServerId}`);
    expect(args![1]).to.include(`ldpServerUrl=${testLdpServerUrl}`);
  });

  it('should throw error when both client-select and performance flags are used', async () => {
    try {
      await LightningDevComponent.run(['--client-select', '--performance', '--target-org', testOrgData.orgId]);
      expect.fail('Expected command to throw an error');
    } catch (error) {
      expect((error as Error).message).to.equal(messages.getMessage('error.performance-client-select-conflict'));
    }
  });

  it('should not include mode=performance in preview URL when no performance flag is provided', async () => {
    const runCmdStub = $$.SANDBOX.stub(OclifConfig.prototype, 'runCommand').resolves();

    await MockedLightningDevComponent.run(['--name', 'testComponent', '--target-org', testOrgData.orgId]);

    expect(runCmdStub.calledOnce).to.be.true;
    const [command, args] = runCmdStub.getCall(0).args;
    expect(command).to.equal('org:open');
    expect(args).to.be.an('array');
    expect(args).to.have.length.greaterThan(1);
    expect(args![1]).to.not.include('mode=performance');
  });

  it('should not include mode=performance in preview URL when client-select flag is used', async () => {
    const runCmdStub = $$.SANDBOX.stub(OclifConfig.prototype, 'runCommand').resolves();

    await MockedLightningDevComponent.run(['--client-select', '--target-org', testOrgData.orgId]);

    expect(runCmdStub.calledOnce).to.be.true;
    const [command, args] = runCmdStub.getCall(0).args;
    expect(command).to.equal('org:open');
    expect(args).to.be.an('array');
    expect(args).to.have.length.greaterThan(1);
    expect(args![1]).to.not.include('mode=performance');
  });

  it('should include mode=performance in preview URL when performance flag is explicitly enabled', async () => {
    const runCmdStub = $$.SANDBOX.stub(OclifConfig.prototype, 'runCommand').resolves();

    await MockedLightningDevComponent.run([
      '--name',
      'testComponent',
      '--performance',
      '--target-org',
      testOrgData.orgId,
    ]);

    expect(runCmdStub.calledOnce).to.be.true;
    const [command, args] = runCmdStub.getCall(0).args;
    expect(command).to.equal('org:open');
    expect(args).to.be.an('array');
    expect(args).to.have.length.greaterThan(1);
    expect(args![1]).to.include('mode=performance');
  });

  it('should include both ldpServerId and ldpServerUrl in preview URL when performance flag is enabled', async () => {
    const runCmdStub = $$.SANDBOX.stub(OclifConfig.prototype, 'runCommand').resolves();

    await MockedLightningDevComponent.run([
      '--name',
      'testComponent',
      '--performance',
      '--target-org',
      testOrgData.orgId,
    ]);

    expect(runCmdStub.calledOnce).to.be.true;
    const [command, args] = runCmdStub.getCall(0).args;
    expect(command).to.equal('org:open');
    expect(args).to.be.an('array');
    expect(args).to.have.length.greaterThan(1);
    expect(args![1]).to.include(`ldpServerId=${testLdpServerId}`);
    expect(args![1]).to.include(`ldpServerUrl=${testLdpServerUrl}`);
    expect(args![1]).to.include('mode=performance');
  });

  it('bypasses component selection prompt when --client-select flag is provided', async () => {
    const runCmdStub = $$.SANDBOX.stub(OclifConfig.prototype, 'runCommand').resolves();
    $$.SANDBOX.stub(PreviewUtils, 'getTargetOrgFromArguments').returns('--target-org=test-org');
    $$.SANDBOX.stub(PreviewUtils, 'generateComponentPreviewLaunchArguments').returns(['--path', '/test/url']);
    const promptStub = $$.SANDBOX.stub(PromptUtils, 'promptUserToSelectComponent');

    await MockedLightningDevComponent.run(['--client-select', '--target-org', testOrgData.orgId]);

    expect(runCmdStub.calledOnce).to.be.true;
    expect(promptStub.called).to.be.false;
  });

  it('prompts user to select component when no --name flag provided and --client-select not used', async () => {
    const runCmdStub = $$.SANDBOX.stub(OclifConfig.prototype, 'runCommand').resolves();
    $$.SANDBOX.stub(PreviewUtils, 'getTargetOrgFromArguments').returns('--target-org=test-org');
    $$.SANDBOX.stub(PreviewUtils, 'generateComponentPreviewLaunchArguments').returns(['--path', '/test/url']);
    const promptStub = $$.SANDBOX.stub(PromptUtils, 'promptUserToSelectComponent').resolves('testComponent');

    await MockedLightningDevComponent.run(['--target-org', testOrgData.orgId]);

    expect(runCmdStub.calledOnce).to.be.true;
    expect(promptStub.calledOnce).to.be.true;
  });

  it('should include specifier=c/<component-name> in preview URL when a component is selected via name flag', async () => {
    const runCmdStub = $$.SANDBOX.stub(OclifConfig.prototype, 'runCommand').resolves();

    await MockedLightningDevComponent.run(['--name', 'testComponent', '--target-org', testOrgData.orgId]);

    expect(runCmdStub.calledOnce).to.be.true;
    const [command, args] = runCmdStub.getCall(0).args;
    expect(command).to.equal('org:open');
    expect(args).to.be.an('array');
    expect(args).to.have.length.greaterThan(1);
    expect(args![1]).to.include('specifier=c/testComponent');
  });

  it('should NOT include specifier query param when client-select flag is used', async () => {
    const runCmdStub = $$.SANDBOX.stub(OclifConfig.prototype, 'runCommand').resolves();

    await MockedLightningDevComponent.run(['--client-select', '--target-org', testOrgData.orgId]);

    expect(runCmdStub.calledOnce).to.be.true;
    const [command, args] = runCmdStub.getCall(0).args;
    expect(command).to.equal('org:open');
    expect(args).to.be.an('array');
    expect(args).to.have.length.greaterThan(1);
    expect(args![1]).to.not.include('specifier=');
  });
});

describe('lightning single component preview - edge cases', () => {
  const $$ = new TestContext();
  let MockedLightningDevComponent: typeof LightningDevComponent;
  beforeEach(async () => {
    stubUx($$.SANDBOX);
    await $$.stubAuths(testOrgData);

    $$.SANDBOX.stub(Connection.prototype, 'getUsername').returns(testUsername);
    $$.SANDBOX.stub(OrgUtils, 'isLocalDevEnabled').resolves(true);
    $$.SANDBOX.stub(OrgUtils, 'ensureMatchingAPIVersion').returns();
    $$.SANDBOX.stub(PreviewUtils, 'getOrCreateAppServerIdentity').resolves(testIdentityData);
    $$.SANDBOX.stub(PreviewUtils, 'initializePreviewConnection').resolves({
      ldpServerId: testLdpServerId,
      ldpServerToken: testLdpServerToken,
      connection: {} as Connection,
    });
    $$.SANDBOX.stub(PreviewUtils, 'generateWebSocketUrlForLocalDevServer').returns(testLdpServerUrl);
    $$.SANDBOX.stub(PreviewUtils, 'getNextAvailablePorts').resolves({ httpPort: 8081, httpsPort: 8082 });
    $$.SANDBOX.stub(ConfigUtils, 'getIdentityData').resolves(testIdentityData);
    $$.SANDBOX.stub(ComponentUtils, 'getNamespacePaths').resolves(['/mock/path']);

    MockedLightningDevComponent = await esmock<typeof LightningDevComponent>(
      '../../../../src/commands/lightning/dev/component.js',
      {
        '../../../../src/lwc-dev-server/index.js': {
          startLWCServer: async () => ({ stopServer: () => {} }),
        },
      }
    );
  });

  afterEach(() => {
    $$.restore();
  });

  it('throws error.directory when no LWC components are found in project', async () => {
    $$.SANDBOX.stub(ComponentUtils, 'getAllComponentPaths').resolves(undefined);

    try {
      await MockedLightningDevComponent.run(['--target-org', testOrgData.orgId]);
      expect.fail('Expected command to throw an error');
    } catch (error) {
      expect((error as Error).message).to.equal(messages.getMessage('error.directory'));
    }
  });

  it('throws error.component-not-found when specified component name does not match any discovered components', async () => {
    $$.SANDBOX.stub(ComponentUtils, 'getAllComponentPaths').resolves(['/mock/component/differentComponent']);
    $$.SANDBOX.stub(ComponentUtils, 'getComponentMetadata').resolves({
      LightningComponentBundle: { masterLabel: 'Different Component', description: 'Different component description' },
    });
    $$.SANDBOX.stub(ComponentUtils, 'componentNameToTitleCase').returns('Different Component');

    try {
      await MockedLightningDevComponent.run(['--name', 'nonExistentComponent', '--target-org', testOrgData.orgId]);
      expect.fail('Expected command to throw an error');
    } catch (error) {
      expect((error as Error).message).to.equal(
        messages.getMessage('error.component-not-found', ['nonExistentComponent'])
      );
    }
  });

  it('throws error.component when user cancels component selection prompt', async () => {
    $$.SANDBOX.stub(ComponentUtils, 'getAllComponentPaths').resolves(['/mock/component/testComponent']);
    $$.SANDBOX.stub(ComponentUtils, 'getComponentMetadata').resolves({
      LightningComponentBundle: { masterLabel: 'Test Component', description: 'Test component description' },
    });
    $$.SANDBOX.stub(ComponentUtils, 'componentNameToTitleCase').returns('Test Component');
    $$.SANDBOX.stub(PromptUtils, 'promptUserToSelectComponent').resolves('');

    try {
      await MockedLightningDevComponent.run(['--target-org', testOrgData.orgId]);
      expect.fail('Expected command to throw an error');
    } catch (error) {
      expect((error as Error).message).to.equal(messages.getMessage('error.component'));
    }
  });

  it('successfully matches component by masterLabel when provided name equals component label', async () => {
    const runCmdStub = $$.SANDBOX.stub(OclifConfig.prototype, 'runCommand').resolves();
    $$.SANDBOX.stub(PreviewUtils, 'getTargetOrgFromArguments').returns('--target-org=test-org');
    $$.SANDBOX.stub(PreviewUtils, 'generateComponentPreviewLaunchArguments').returns(['--path', '/test/url']);
    $$.SANDBOX.stub(ComponentUtils, 'getAllComponentPaths').resolves(['/mock/component/testComponent']);
    $$.SANDBOX.stub(ComponentUtils, 'getComponentMetadata').resolves({
      LightningComponentBundle: {
        masterLabel: 'My Test Component',
        description: 'Test component description',
      },
    });
    $$.SANDBOX.stub(ComponentUtils, 'componentNameToTitleCase').returns('My Test Component');

    await MockedLightningDevComponent.run(['--name', 'My Test Component', '--target-org', testOrgData.orgId]);

    expect(runCmdStub.calledOnce).to.be.true;
  });

  it('should include specifier=c/<component-name> in preview URL when a component is selected via prompt', async () => {
    const runCmdStub = $$.SANDBOX.stub(OclifConfig.prototype, 'runCommand').resolves();
    $$.SANDBOX.stub(ComponentUtils, 'getAllComponentPaths').resolves(['/mock/component/selectedComponent']);
    $$.SANDBOX.stub(ComponentUtils, 'getComponentMetadata').resolves({
      LightningComponentBundle: {
        masterLabel: 'Selected Component',
        description: 'Selected component description',
      },
    });
    $$.SANDBOX.stub(ComponentUtils, 'componentNameToTitleCase').returns('Selected Component');
    $$.SANDBOX.stub(PromptUtils, 'promptUserToSelectComponent').resolves('selectedComponent');

    await MockedLightningDevComponent.run(['--target-org', testOrgData.orgId]);

    expect(runCmdStub.calledOnce).to.be.true;
    const [command, args] = runCmdStub.getCall(0).args;
    expect(command).to.equal('org:open');
    expect(args).to.be.an('array');
    expect(args).to.have.length.greaterThan(1);
    expect(args![1]).to.include('specifier=c/selectedComponent');
  });
});
