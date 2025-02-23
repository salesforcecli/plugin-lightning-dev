/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import fs from 'node:fs';
import path from 'node:path';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { cmpDev } from '@lwrjs/api';
import { PromptUtils } from '../../../shared/promptUtils.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-lightning-dev', 'lightning.dev.component');

// TODO support other module directories
const MODULES_DIR = path.resolve(path.join('force-app', 'main', 'default', 'lwc'));

function getDirectories(filePath: string): string[] {
  try {
    const items = fs.readdirSync(filePath);

    const directories = items.filter((item) => fs.statSync(path.join(filePath, item)).isDirectory());

    return directories;
  } catch (error) {
    return [];
  }
}

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
    const { flags } = await this.parse(LightningDevComponent);

    let name = flags.name;
    if (!name) {
      const dirs = getDirectories(path.resolve(MODULES_DIR));
      if (!dirs) {
        throw new Error(messages.getMessage('error.directory'));
      }

      const components = dirs.map((dir) => {
        const xmlPath = path.resolve(path.join(MODULES_DIR, dir, `${dir}.js-meta.xml`));
        const xmlContent = fs.readFileSync(xmlPath, 'utf-8');
        const label = xmlContent.match(/<masterLabel>(.*?)<\/masterLabel>/);
        const description = xmlContent.match(/<description>(.*?)<\/description>/);

        return {
          name: dir,
          label: label ? label[1] : '',
          description: description ? description[1] : '',
        };
      });

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
