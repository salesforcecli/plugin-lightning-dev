/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import path from 'node:path';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages, SfProject } from '@salesforce/core';
import { ComponentUtils } from '../../../shared/componentUtils.js';
import { PromptUtils } from '../../../shared/promptUtils.js';
import { PreviewUtils } from '../../../shared/previewUtils.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-lightning-dev', 'lightning.dev.component');

// TODO: generate ldp server url
const ldpServerUrl = 'http://localhost:3000';

export default class LightningDevComponent extends SfCommand<void> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    name: Flags.string({
      summary: messages.getMessage('flags.name.summary'),
      char: 'n',
      requiredOrDefaulted: false,
    }),
    'client-select': Flags.boolean({
      summary: messages.getMessage('flags.client-select.summary'),
      char: 'c',
      default: false,
    }),
    'target-org': Flags.requiredOrg(),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(LightningDevComponent);
    const project = await SfProject.resolve();

    let componentName = flags['name'];
    const clientSelect = flags['client-select'];
    const targetOrg = flags['target-org'];

    const { ldpServerId } = await PreviewUtils.initializePreviewConnection(targetOrg);

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

    if (!clientSelect) {
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

    // TODO: launch the local dev server

    const targetOrgArg = PreviewUtils.getTargetOrgFromArguments(this.argv);
    const launchArguments = PreviewUtils.generateComponentPreviewLaunchArguments(
      ldpServerUrl,
      ldpServerId,
      componentName,
      targetOrgArg
    );

    // Open the browser and navigate to the right page
    await this.config.runCommand('org:open', launchArguments);
  }
}
