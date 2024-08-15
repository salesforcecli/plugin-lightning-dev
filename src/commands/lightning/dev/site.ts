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
import { expDev } from '@lwrjs/api';
import { PromptUtils } from '../../../shared/prompt.js';
// import { OrgUtils } from '../../../shared/orgUtils.js';
import { ExperienceSite } from '../../../shared/experience/expSite.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-lightning-dev', 'lightning.dev.site');

// looks like this might have meant to be a return type?
export type LightningDevSiteResult = {
  path: string;
};

export default class LightningDevSite extends SfCommand<void> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  // if this isn't ready for public use, you can mark it hidden like public static hidden = true;

  public static readonly flags = {
    name: Flags.string({
      summary: messages.getMessage('flags.name.summary'),
      char: 'n',
      required: false, // can be omitted
    }),
    debug: Flags.boolean({
      // doesn't appear to be used.  Remove?
      summary: messages.getMessage('flags.debug.summary'),
    }),
    // again, you probably want api-version flag and have it depend on target-org being present
    'target-org': Flags.optionalOrg({ summary: messages.getMessage('flags.target-org.summary') }), // the summary isn't adding anything.  I'd remove it so the standard on appears
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(LightningDevSite);

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

      // 3. Setup local dev directory structure: '.localdev/${site}'
      this.log(`Setting up Local Development for: ${siteName}`);
      const selectedSite = new ExperienceSite(org, siteName);
      let siteZip;
      if (!selectedSite.isSiteSetup()) {
        // TODO Verify the bundle has been published and download
        this.log('Downloading Site...');
        siteZip = await selectedSite.downloadSite();
      } else {
        // If we do have the site setup already, don't do anything / TODO prompt the user if they want to get latest?
        // Check if the site has been published
        // const result = await connection.query<{ Id: string; Name: string; LastModifiedDate: string }>(
        //   "SELECT Id, Name, LastModifiedDate FROM StaticResource WHERE Name LIKE 'MRT%" + siteName + "'"
        // );
        // this.log('Setup already complete!');
      }

      // 6. Start the dev server
      this.log('Starting local development server...');
      await expDev({
        open: false,
        port: 3000,
        logLevel: 'error',
        mode: 'dev', // doesn't match the type
        siteZip,
        siteDir: selectedSite.getSiteDirectory(),
      });
    } catch (e) {
      // this.error(e);
      this.log('Local Development setup failed', e);
    }
  }
}
