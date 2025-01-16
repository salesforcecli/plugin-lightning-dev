/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { cmpDev } from '@lwrjs/api';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-lightning-dev', 'lightning.dev.component');

export default class LightningDevComponent extends SfCommand<void> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    'target-org': Flags.optionalOrg(), // Don't necessarily require org unless we need to proxy
    name: Flags.string({
      char: 'n',
      summary: messages.getMessage('flags.name.summary'),
      required: true,
    }),
    namespace: Flags.string({
      char: 's',
      summary: messages.getMessage('flags.namespace.summary'),
      default: 'c',
    }),
    attributes: Flags.string({
      char: 'a',
      summary: messages.getMessage('flags.attributes.summary'),
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(LightningDevComponent);

    const connection = flags['target-org']?.getConnection();

    let attributes = {};
    if (flags.attributes) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        attributes = JSON.parse(flags.attributes);
      } catch (e) {
        throw new Error(messages.getMessage('error.invalid.attributes'));
      }
    }

    await cmpDev({
      componentName: flags.name,
      namespace: flags.namespace,
      attributes,
      mode: 'dev',
      siteDir: '', // TODO fix
      port: 3000,
      open: true,
      logLevel: 'info',
      authToken: connection?.accessToken ?? '',
    });
  }
}
