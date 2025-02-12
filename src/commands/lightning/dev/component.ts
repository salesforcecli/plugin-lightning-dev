/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { cmpDev } from '@lwrjs/api';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-lightning-dev', 'lightning.dev.component');

export type LightningDevComponentResult = {
  path: string;
};

export default class LightningDevComponent extends SfCommand<LightningDevComponentResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    name: Flags.string({
      summary: messages.getMessage('flags.name.summary'),
      description: messages.getMessage('flags.name.description'),
      char: 'n',
      required: false,
    }),
  };

  public async run(): Promise<LightningDevComponentResult> {
    const { flags } = await this.parse(LightningDevComponent);

    const name = flags.name ?? 'world';
    this.log(`preview component: ${name}`);

    // TODO implement me
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    await cmpDev({
      componentName: name,
    });

    return {
      path: '',
    };
  }
}
