/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
// import fs from 'node:fs';
// import path from 'node:path';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { expDev, setupDev } from '@lwrjs/api';
import { PromptUtils } from '../../../shared/prompt.js';
// import { OrgUtils } from '../../../shared/orgUtils.js';
import { ExperienceSite } from '../../../shared/experience/expSite.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-lightning-dev', 'lightning.preview.site');

export type LightningPreviewSiteResult = {
  path: string;
};

export default class LightningPreviewSite extends SfCommand<void> {
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
    debug: Flags.boolean({
      summary: messages.getMessage('flags.debug.summary'),
    }),
    'target-org': Flags.optionalOrg(),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(LightningPreviewSite);

    // TODO short circuit all this if user specifies a site name and it exists locally

    try {
      // 1. Connect to Org
      const org = flags['target-org'];
      let siteName = flags.name;

      // 2. If we don't have a site to use, prompt the user for one
      if (!siteName) {
        this.log('No site was specified');
        // Allow user to pick a site
        const siteList = await ExperienceSite.getAllExpSites(org.getConnection());
        siteName = await PromptUtils.promptUserToSelectSite(siteList);
      }

      // 3. Setup local dev directory structure: '__local_dev__/${site}'
      this.log(`Setting up Local Development for: ${siteName}`);
      const selectedSite = new ExperienceSite(org, siteName);
      if (!selectedSite.isSiteSetup()) {
        // TODO Verify the bundle has been published and download
        this.log('Downloading Site...');
        const siteZip = await selectedSite.downloadSite();

        // Setup Local Dev
        await setupDev({ mrtBundle: siteZip, mrtDir: selectedSite.getExtractDirectory() });
        this.log('Setup Complete!');
      } else {
        // If we do have the site setup already, don't do anything / TODO prompt the user if they want to get latest?

        // Check if the site has been published
        // const result = await connection.query<{ Id: string; Name: string; LastModifiedDate: string }>(
        //   "SELECT Id, Name, LastModifiedDate FROM StaticResource WHERE Name LIKE 'MRT%" + siteName + "'"
        // );
        this.log('Setup already complete!');
      }

      // 6. Start the dev server
      this.log('Starting local development server...');
      await expDev({
        open: false,
        port: 3000,
        logLevel: 'error',
        siteDir: selectedSite.getExtractDirectory(),
      });
    } catch (e) {
      // this.error(e);
      this.log('Local Development setup failed', e);
    }
  }
}
