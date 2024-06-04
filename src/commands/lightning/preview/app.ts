/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages, Logger } from '@salesforce/core';
import { startLWCServer } from '../../../lwc-dev-server/index.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-lightning-dev', 'lightning.preview.app');

export type LightningPreviewAppResult = {
  path: string;
};

export default class LightningPreviewApp extends SfCommand<LightningPreviewAppResult> {
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

  public async run(): Promise<LightningPreviewAppResult> {
    const { flags } = await this.parse(LightningPreviewApp);
    const log = await Logger.child(this.ctor.name);

    await startLWCServer(log);

    const name = flags.name ?? 'world';
    this.log(`hello ${name} from /Users/nkruk/git/plugin-lightning-dev/src/commands/lightning/preview/org.ts`);
    return {
      path: '/Users/nkruk/git/plugin-lightning-dev/src/commands/lightning/preview/org.ts',
    };
  }
}
