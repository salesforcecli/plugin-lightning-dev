/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import fs from 'node:fs';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { expDev } from '@lwrjs/api';
import { OrgUtils } from '../../../shared/orgUtils.js';
import { PromptUtils } from '../../../shared/prompt.js';
import { ExperienceSite } from '../../../shared/experience/expSite.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-lightning-dev', 'lightning.dev.site');
const sharedMessages = Messages.loadMessages('@salesforce/plugin-lightning-dev', 'shared.utils');

export default class LightningDevSite extends SfCommand<void> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly enableJsonFlag = false; // Disable json flag since we don't return anything

  public static readonly flags = {
    name: Flags.string({
      summary: messages.getMessage('flags.name.summary'),
      char: 'n',
    }),
    'target-org': Flags.requiredOrg(),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(LightningDevSite);

    try {
      const org = flags['target-org'];
      let siteName = flags.name;

      const localDevEnabled = await OrgUtils.isLocalDevEnabled(org.getConnection(undefined));
      if (!localDevEnabled) {
        throw new Error(sharedMessages.getMessage('error.localdev.not.enabled'));
      }

      // If user doesn't specify a site, prompt the user for one
      if (!siteName) {
        const allSites = await ExperienceSite.getAllExpSites(org);
        siteName = await PromptUtils.promptUserToSelectSite(allSites);
      }

      const selectedSite = new ExperienceSite(org, siteName);
      let siteZip: string | undefined;

      if (!selectedSite.isSiteSetup()) {
        this.log(`[local-dev] initializing: ${siteName}`);
        siteZip = await selectedSite.downloadSite();
      } else {
        // If local-dev is already setup, check if an updated site has been published to download
        const updateAvailable = await selectedSite.isUpdateAvailable();
        if (updateAvailable) {
          const shouldUpdate = await PromptUtils.promptUserToConfirmUpdate(siteName);
          if (shouldUpdate) {
            this.log(`[local-dev] updating: ${siteName}`);
            siteZip = await selectedSite.downloadSite();
            // delete oldSitePath recursive
            const oldSitePath = selectedSite.getExtractDirectory();
            if (fs.existsSync(oldSitePath)) {
              fs.rmdirSync(oldSitePath, { recursive: true });
            }
          }
        }
      }

      // Establish a valid access token for this site
      const authToken = await selectedSite.setupAuth();

      // Start the dev server
      await expDev({
        authToken,
        open: true,
        port: 3000,
        logLevel: 'error',
        mode: 'dev',
        siteZip,
        siteDir: selectedSite.getSiteDirectory(),
      });
    } catch (e) {
      this.log('Local Development setup failed', e);
    }
  }
}
