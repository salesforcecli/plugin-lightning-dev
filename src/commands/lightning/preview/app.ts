/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages, Logger, Org } from '@salesforce/core';
import { PreviewUtils } from '@salesforce/lwc-dev-mobile-core';
import { OrgUtils } from '../../../shared/orgUtils.js';
import { startLWCServer } from '../../../lwc-dev-server/index.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-lightning-dev', 'lightning.preview.app');

enum Platform {
  desktop = 'desktop',
  ios = 'ios',
  android = 'android',
}

type LightningPreviewAppFlags = {
  name: string | undefined;
  'target-org': Org;
  'device-type': Platform;
  'device-id': string | undefined;
};

export default class LightningPreviewApp extends SfCommand<void> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    name: Flags.string({
      summary: messages.getMessage('flags.name.summary'),
      char: 'n',
    }),
    'target-org': Flags.requiredOrg({
      summary: messages.getMessage('flags.target-org.summary'),
    }),
    'device-type': Flags.option({
      summary: messages.getMessage('flags.device-type.summary'),
      char: 't',
      options: [Platform.desktop, Platform.ios, Platform.android] as const,
      default: Platform.desktop,
    })(),
    'device-id': Flags.string({
      summary: messages.getMessage('flags.device-id.summary'),
      char: 'i',
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(LightningPreviewApp);
    const logger = await Logger.child(this.ctor.name);

    await startLWCServer(logger);

    if (flags['device-type'] === Platform.desktop) {
      await this.desktopPreview(logger, flags);
    } else if (flags['device-type'] === Platform.ios) {
      await this.iosPreview(logger, flags);
    } else if (flags['device-type'] === Platform.android) {
      await this.androidPreview(logger, flags);
    }
  }

  private async desktopPreview(logger: Logger, flags: LightningPreviewAppFlags): Promise<void> {
    const appName = flags['name'];
    const targetOrg = flags['target-org'];
    const platform = flags['device-type'];

    logger.debug('Determining Local Dev Server url');
    // todo: figure out how to make the port dynamic instead of hard-coded value here
    const ldpServerUrl = PreviewUtils.generateWebSocketUrlForLocalDevServer(platform, '8081');
    logger.debug(`Local Dev Server url is ${ldpServerUrl}`);

    // appPath will resolve to one of the following:
    //
    //   lightning/app/<appId> => when the user is targetting a specific LEX app
    //               lightning => when the user is not targetting a specific LEX app
    //
    let appPath = '';
    if (appName) {
      logger.debug(`Determining App Id for ${appName}`);

      // The appName is optional but if the user did provide an appName then it must be
      // a valid one.... meaning that it should resolve to a valid appId.
      const appId = await OrgUtils.getAppId(targetOrg.getConnection(undefined), appName);
      if (!appId) {
        throw new Error(messages.getMessage('error.fetching.app-id', [appName]));
      }

      logger.debug(`App Id is ${appId}`);

      appPath = `lightning/app/${appId}`;
    } else {
      logger.debug('No Lightning Experience application name provided.... using the default app instead.');
      appPath = 'lightning';
    }

    // we prepend a '0.' to all of the params to ensure they will persist across redirects
    const orgOpenCommandArgs = ['--path', `${appPath}?0.aura.ldpServerUrl=${ldpServerUrl}&0.aura.mode=DEVPREVIEW`];

    // There are various ways to pass in a target org (as an alias, as a username, etc).
    // We could have LightningPreviewApp parse its --target-org flag which will be resolved
    // to an Org object (see https://github.com/forcedotcom/sfdx-core/blob/main/src/org/org.ts)
    // then write a bunch of code to look at this Org object to try to determine whether
    // it was initialized using Alis, Username, etc. and get a string representation of the
    // org to be forwarded to OrgOpenCommand.
    //
    // Or we could simply look at the raw arguments passed to the LightningPreviewApp command,
    // find the raw value for --target-org flag and forward that raw value to OrgOpenCommand.
    // The OrgOpenCommand will then parse the raw value automatically. If the value is
    // valid then OrgOpenCommand will consume it and continue. And if the value is invalid then
    // OrgOpenCommand simply throws an error which will get bubbled up to LightningPreviewApp.
    //
    // Here we've chosen the second approach
    const idx = this.argv.findIndex((item) => item.toLowerCase() === '-o' || item.toLowerCase() === '--target-org');
    if (idx >= 0 && idx < this.argv.length - 1) {
      orgOpenCommandArgs.push('--target-org', this.argv[idx + 1]);
    }

    await this.config.runCommand('org:open', orgOpenCommandArgs);
  }

  // eslint-disable-next-line class-methods-use-this, @typescript-eslint/no-unused-vars
  private async iosPreview(logger: Logger, flags: LightningPreviewAppFlags): Promise<void> {
    logger.info('Preview on iOS Not Implemented Yet');
    return Promise.reject(new Error('Preview on iOS Not Implemented Yet'));
  }

  // eslint-disable-next-line class-methods-use-this, @typescript-eslint/no-unused-vars
  private async androidPreview(logger: Logger, flags: LightningPreviewAppFlags): Promise<void> {
    logger.info('Preview on Android Not Implemented Yet');
    return Promise.reject(new Error('Preview on Android Not Implemented Yet'));
  }
}
