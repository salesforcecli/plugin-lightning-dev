/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import path from 'node:path';
import url from 'node:url';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages, SfProject } from '@salesforce/core';
import { cmpDev } from '@lwrjs/api';
import { ComponentUtils } from '../../../shared/componentUtils.js';
import { PromptUtils } from '../../../shared/promptUtils.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-lightning-dev', 'lightning.dev.component');

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
    // TODO should this be required or optional?
    // We don't technically need this if your components are simple / don't need any data from your org
    'target-org': Flags.optionalOrg(),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(LightningDevComponent);
    const project = await SfProject.resolve();

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

          const componentName = path.basename(componentPath);
          const label = ComponentUtils.componentNameToTitleCase(componentName);

          return {
            name: componentName,
            label: xml.LightningComponentBundle.masterLabel ?? label,
            description: xml.LightningComponentBundle.description ?? '',
          };
        })
      )
    ).filter((component) => !!component);

    let name = flags.name;
    if (!flags['client-select']) {
      if (name) {
        // validate that the component exists before launching the server
        const match = components.find((component) => name === component.name || name === component.label);
        if (!match) {
          throw new Error(messages.getMessage('error.component-not-found', [name]));
        }

        name = match.name;
      } else {
        // prompt the user for a name if one was not provided
        name = await PromptUtils.promptUserToSelectComponent(components);
        if (!name) {
          throw new Error(messages.getMessage('error.component'));
        }
      }
    }

    const dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const rootDir = path.resolve(dirname, '../../../..');
    const port = parseInt(process.env.PORT ?? '3000', 10);

    await cmpDev({
      rootDir,
      mode: 'dev',
      port,
      name: name ? `c/${name}` : undefined,
      namespacePaths,
      open: process.env.OPEN_BROWSER === 'false' ? false : true,
    });
  }
}
