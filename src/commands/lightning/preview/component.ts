/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-lightning-dev', 'lightning.preview.component');

export type LightningPreviewComponentResult = {
  path: string;
};

export default class LightningPreviewComponent extends SfCommand<LightningPreviewComponentResult> {
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

  public async run(): Promise<LightningPreviewComponentResult> {
    const { flags } = await this.parse(LightningPreviewComponent);

    const name = flags.name ?? 'world';
    this.log(`hello ${name} from /Users/nkruk/git/plugin-lightning-dev/src/commands/lightning/preview/component.ts`);
    return {
      path: '/Users/nkruk/git/plugin-lightning-dev/src/commands/lightning/preview/component.ts',
    };
  }
}
