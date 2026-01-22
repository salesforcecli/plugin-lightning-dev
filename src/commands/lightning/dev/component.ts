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

import path from 'node:path';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages, SfProject, Logger } from '@salesforce/core';
import { Platform } from '@salesforce/lwc-dev-mobile-core';
import { ComponentUtils } from '../../../shared/componentUtils.js';
import { PromptUtils } from '../../../shared/promptUtils.js';
import { PreviewUtils } from '../../../shared/previewUtils.js';
import { startLWCServer } from '../../../lwc-dev-server/index.js';
import { MetaUtils } from '../../../shared/metaUtils.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-lightning-dev', 'lightning.dev.component');
const sharedMessages = Messages.loadMessages('@salesforce/plugin-lightning-dev', 'shared.utils');

export type ComponentPreviewResult = {
  instanceUrl: string;
  ldpServerUrl: string;
  ldpServerId: string;
  componentName: string;
  previewUrl: string;
};

export default class LightningDevComponent extends SfCommand<ComponentPreviewResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    name: Flags.string({
      summary: messages.getMessage('flags.name.summary'),
      char: 'n',
      requiredOrDefaulted: false,
    }),
    'api-version': Flags.orgApiVersion(),
    'client-select': Flags.boolean({
      summary: messages.getMessage('flags.client-select.summary'),
      char: 'c',
      default: false,
    }),
    'target-org': Flags.requiredOrg(),
  };

  public async run(): Promise<ComponentPreviewResult> {
    const { flags } = await this.parse(LightningDevComponent);
    const logger = await Logger.child(this.ctor.name);
    const project = await SfProject.resolve();

    let sfdxProjectRootPath = '';
    try {
      sfdxProjectRootPath = await SfProject.resolveProjectPath();
    } catch (error) {
      return Promise.reject(
        new Error(sharedMessages.getMessage('error.no-project', [(error as Error)?.message ?? '']))
      );
    }

    let componentName = flags['name'];
    const clientSelect = flags['client-select'];
    const targetOrg = flags['target-org'];
    const apiVersion = flags['api-version'];

    const connection = targetOrg.getConnection(apiVersion);

    if (await MetaUtils.handleLocalDevEnablement(connection)) {
      this.log(sharedMessages.getMessage('localdev.enabled'));
    }

    const { ldpServerId, ldpServerToken } = await PreviewUtils.initializePreviewConnection(connection);

    logger.debug('Determining the next available port for Local Dev Server');
    const serverPorts = await PreviewUtils.getNextAvailablePorts();
    logger.debug(`Next available ports are http=${serverPorts.httpPort} , https=${serverPorts.httpsPort}`);

    logger.debug('Determining Local Dev Server url');
    let ldpServerUrl;

    // In Code Builder, we cannot go to localhost - we need to use a proxy URI to get to the ldpServer
    if (process.env.SF_CONTAINER_MODE && process.env.VSCODE_PROXY_URI) {
      logger.debug('In Code Builder Mode - using proxy URI');
      ldpServerUrl = process.env.VSCODE_PROXY_URI.replace('https://', 'ws://').replace(
        '{{port}}',
        `${serverPorts.httpPort}`
      );
    } else {
      // Default behavior
      ldpServerUrl = PreviewUtils.generateWebSocketUrlForLocalDevServer(Platform.desktop, serverPorts, logger);
    }
    logger.debug(`Local Dev Server url is ${ldpServerUrl}`);

    if (!clientSelect) {
      const namespacePaths = await ComponentUtils.getNamespacePaths(project);
      const componentPaths = await ComponentUtils.getAllComponentPaths(namespacePaths);
      if (!componentPaths) {
        throw new Error(messages.getMessage('error.directory'));
      }

      const components = (
        await Promise.all(
          componentPaths.map(async (componentPath) => {
            let xml;

            try {
              xml = await ComponentUtils.getComponentMetadata(componentPath);
            } catch (err) {
              this.warn(messages.getMessage('error.component-metadata', [componentPath]));
            }

            // components must have meta xml to be previewed
            if (!xml) {
              return undefined;
            }

            const name = path.basename(componentPath);
            const label = ComponentUtils.componentNameToTitleCase(name);

            return {
              name,
              label: xml.LightningComponentBundle.masterLabel ?? label,
              description: xml.LightningComponentBundle.description ?? '',
            };
          })
        )
      ).filter((component) => !!component);

      if (componentName) {
        // validate that the component exists before launching the server
        const match = components.find(
          (component) => componentName === component.name || componentName === component.label
        );
        if (!match) {
          throw new Error(messages.getMessage('error.component-not-found', [componentName]));
        }

        componentName = match.name;
      } else {
        // prompt the user for a name if one was not provided
        componentName = await PromptUtils.promptUserToSelectComponent(components);
        if (!componentName) {
          throw new Error(messages.getMessage('error.component'));
        }
      }
    }

    await startLWCServer(logger, sfdxProjectRootPath, ldpServerToken, Platform.desktop, serverPorts);

    const targetOrgArg = PreviewUtils.getTargetOrgFromArguments(this.argv);
    const launchArguments = PreviewUtils.generateComponentPreviewLaunchArguments(
      ldpServerUrl,
      ldpServerId,
      componentName,
      targetOrgArg
    );

    // strip trailing slashes
    const instanceUrl = connection.instanceUrl.replace(/\/$/, '');

    const previewUrl = PreviewUtils.generateComponentPreviewUrl(instanceUrl, ldpServerUrl, ldpServerId, componentName);

    // Prepare the result for JSON output
    const result: ComponentPreviewResult = {
      instanceUrl,
      ldpServerUrl,
      ldpServerId,
      componentName: componentName ?? '',
      previewUrl,
    };

    // Open the browser and navigate to the right page (unless OPEN_BROWSER is set to true)
    if (process.env.OPEN_BROWSER !== 'false') {
      await this.config.runCommand('org:open', launchArguments);
    }

    return result;
  }
}
