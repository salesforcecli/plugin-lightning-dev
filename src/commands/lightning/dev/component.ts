/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import path from 'node:path';
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
    // TODO should this be required or optional?
    // We don't technically need this if your components are simple / don't need any data from your org
    'target-org': Flags.optionalOrg(),
  };

  public async run(): Promise<void> {
    const project = await SfProject.resolve();
    const { flags } = await this.parse(LightningDevComponent);

    let name = flags.name;
    if (!name) {
      const dirs = await ComponentUtils.getComponentPaths(project);
      if (!dirs) {
        throw new Error(messages.getMessage('error.directory'));
      }

      const components = (
        await Promise.all(
          dirs.map(async (dir) => {
            const xml = await ComponentUtils.getComponentMetadata(dir);
            if (!xml) {
              return undefined;
            }

            const componentName = path.basename(dir);
            const label = ComponentUtils.componentNameToTitleCase(componentName);

            return {
              name: componentName,
              label: xml.LightningComponentBundle.masterLabel ?? label,
              description: xml.LightningComponentBundle.description ?? '',
            };
          })
        )
      ).filter((component) => !!component);

      name = await PromptUtils.promptUserToSelectComponent(components);
      if (!name) {
        throw new Error(messages.getMessage('error.component'));
      }
    }

    this.log('Starting application on port 3000...');

    const port = parseInt(process.env.PORT ?? '3000', 10);

    await cmpDev({
      mode: 'dev',
      port,
      name: `c/${name}`,
    });
  }
}
