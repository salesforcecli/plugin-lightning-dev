/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import fs from 'node:fs';
import path from 'node:path';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages, SfError } from '@salesforce/core';
import { expDev, setupDev } from '@lwrjs/api';
import { PromptUtils } from '../../../shared/prompt.js';
import { OrgUtils } from '../../../shared/orgUtils.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-lightning-dev', 'lightning.preview.site');

export type LightningPreviewSiteResult = {
  path: string;
};

export default class LightningPreviewSite extends SfCommand<LightningPreviewSiteResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    name: Flags.string({
      summary: messages.getMessage('flags.name.summary'),
      char: 'n',
      required: false,
    }),
    debug: Flags.boolean({
      summary: messages.getMessage('flags.debug.summary'),
    }),
    'target-org': Flags.optionalOrg(),
  };

  public async run(): Promise<LightningPreviewSiteResult> {
    const { flags } = await this.parse(LightningPreviewSite);
    // Connect to Org
    const connection = flags['target-org'].getConnection();

    // If we don't have a site to use, promp the user for one
    let siteName = flags.name;
    if (!siteName) {
      this.log('No site name was specified, pick one');
      // Query for the list of possible sites
      const siteList = await OrgUtils.retrieveSites(connection);
      siteName = await PromptUtils.promptUserToSelectSite(siteList);
    }
    this.log(`Setting up local development for: ${siteName}`);

    siteName = siteName.trim().replace(' ', '_');
    const siteDir = path.join('__local_dev__', siteName);
    if (!fs.existsSync(path.join(siteDir, 'ssr.js'))) {
      // Ensure local dev dir is created
      fs.mkdirSync('__local_dev__');
      // 3. Check if the site has been published
      const result = await connection.query<{ Id: string; Name: string; LastModifiedDate: string }>(
        "SELECT Id, Name, LastModifiedDate FROM StaticResource WHERE Name LIKE 'MRT%" + siteName + "'"
      );

      let resourceName;
      // Pick the site you want if there is more than one
      if (result?.totalSize > 1) {
        const chooseFromList = result.records.map((record) => record.Name);
        resourceName = await PromptUtils.promptUserToSelectSite(chooseFromList);
      } else if (result?.totalSize === 1) {
        resourceName = result.records[0].Name;
      } else {
        throw new SfError(
          `Couldnt find your site: ${siteName}. Please navigate to the builder and publish your site with the Local Development preference enabled in your org.`
        );
      }

      // Download the static resource
      this.log('Downloading Site...');
      const staticresource = await connection.metadata.read('StaticResource', resourceName);
      const resourcePath = path.join('__local_dev__', `${resourceName}.gz`);
      if (staticresource?.content) {
        // Save the static resource
        const buffer = Buffer.from(staticresource.content, 'base64');
        this.log(`Writing file to path: ${resourcePath}`);
        fs.writeFileSync(resourcePath, buffer);
      } else {
        throw new SfError(`Error occured downloading your site: ${siteName}`);
      }

      const domains = await OrgUtils.getDomains(connection);
      const domain = await PromptUtils.promptUserToSelectDomain(domains);
      const urlPrefix = await OrgUtils.getSitePathPrefix(connection, siteName);
      const fullProxyUrl = `https://${domain}${urlPrefix}`;

      // Setup Local Dev
      await setupDev({ mrtBundle: resourcePath, mrtDir: siteDir, proxyUrl: fullProxyUrl, npmInstall: false });
      this.log('Setup Complete!');
    } else {
      // If we do have the site setup already, don't do anything / TODO prompt the user if they want to get latest?
    }

    // 6. Start the dev server
    this.log('Starting local development server...');
    // TODO add additional args
    // eslint-disable-next-line unicorn/numeric-separators-style
    await expDev({
      open: false,
      port: 3000,
      timeout: 30000,
      sandbox: false,
      logLevel: 'error',
      mrtBundleRoot: siteDir,
    });
    // const name = flags.name ?? 'world';
    // this.log(`hello ${name} from /Users/nkruk/git/plugin-lightning-dev/src/commands/lightning/preview/site.ts`);
    return {
      path: '/Users/nkruk/git/plugin-lightning-dev/src/commands/lightning/preview/site.ts',
    };
  }
}
