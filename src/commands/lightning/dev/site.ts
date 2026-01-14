/*
 * Copyright 2026, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import fs from 'node:fs';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Connection, Logger, Messages, SfProject } from '@salesforce/core';
import { Platform } from '@salesforce/lwc-dev-mobile-core';
import { expDev, SitesLocalDevOptions, setupDev } from '@lwrjs/api';
import open from 'open';
import { OrgUtils } from '../../../shared/orgUtils.js';
import { PromptUtils } from '../../../shared/promptUtils.js';
import { ExperienceSite } from '../../../shared/experience/expSite.js';
import { PreviewUtils } from '../../../shared/previewUtils.js';
import { startLWCServer } from '../../../lwc-dev-server/index.js';
import { MetaUtils } from '../../../shared/metaUtils.js';

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
    'get-latest': Flags.boolean({
      summary: messages.getMessage('flags.get-latest.summary'),
      char: 'l',
    }),
    guest: Flags.boolean({
      summary: messages.getMessage('flags.guest.summary'),
      default: false,
    }),
    ssr: Flags.boolean({
      summary: messages.getMessage('flags.ssr.summary'),
      default: false,
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(LightningDevSite);

    try {
      const org = flags['target-org'];
      const getLatest = flags['get-latest'];
      const guest = flags.guest;
      const ssr = flags.ssr;
      let siteName = flags.name;

      const connection = org.getConnection(undefined);

      if (await MetaUtils.handleLocalDevEnablement(connection)) {
        this.log(sharedMessages.getMessage('localdev.enabled'));
      }

      OrgUtils.ensureMatchingAPIVersion(connection);

      // If user doesn't specify a site, prompt the user for one
      if (!siteName) {
        const allSites = await ExperienceSite.getAllExpSites(org);
        siteName = await PromptUtils.promptUserToSelectSite(allSites);
      }

      const selectedSite = new ExperienceSite(org, siteName);

      if (!ssr) {
        return await this.openPreviewUrl(selectedSite, connection);
      }
      await this.serveSSRSite(selectedSite, getLatest, siteName, guest);
    } catch (e) {
      this.spinner.stop('failed.');
      this.log('Local Development setup failed', e);
    }
  }

  private async serveSSRSite(
    selectedSite: ExperienceSite,
    getLatest: boolean,
    siteName: string,
    guest: boolean
  ): Promise<void> {
    let siteZip: string | undefined;

    // If the site is not setup / is not based on the current release / or get-latest is requested ->
    // generate and download a new site bundle from the org based on latest builder metadata
    if (!selectedSite.isSiteSetup() || getLatest) {
      const startTime = Date.now();
      this.log(`[local-dev] Initializing: ${siteName}`);
      this.spinner.start('[local-dev] Downloading site (this may take a few minutes)');
      siteZip = await selectedSite.downloadSite();

      // delete oldSitePath recursive
      const oldSitePath = selectedSite.getExtractDirectory();
      if (fs.existsSync(oldSitePath)) {
        fs.rmSync(oldSitePath, { recursive: true });
      }
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000; // Convert to seconds
      this.spinner.stop('done.');
      this.log(`[local-dev] Site setup completed in ${duration.toFixed(2)} seconds.`);
    }

    this.log(`[local-dev] launching browser preview for: ${siteName}`);

    // Establish a valid access token for this site
    const authToken = guest ? '' : await selectedSite.setupAuth();

    // Start the dev server
    const port = parseInt(process.env.PORT ?? '3000', 10);

    // Internal vs external mode
    const internalProject = !fs.existsSync('sfdx-project.json') && fs.existsSync('lwr.config.json');
    const logLevel = process.env.LOG_LEVEL ?? 'error';

    const startupParams: SitesLocalDevOptions = {
      sfCLI: !internalProject,
      authToken,
      open: process.env.OPEN_BROWSER === 'false' ? false : true,
      port,
      logLevel,
      mode: 'dev',
      siteZip,
      siteDir: selectedSite.getSiteDirectory(),
    };

    // Environment variable used to setup the site rather than setup & start server
    if (process.env.SETUP_ONLY === 'true') {
      await setupDev(startupParams);
      this.log('[local-dev] setup complete!');
    } else {
      await expDev(startupParams);
      this.log('[local-dev] watching for file changes... (CTRL-C to stop)');
    }
  }

  private async openPreviewUrl(selectedSite: ExperienceSite, connection: Connection): Promise<void> {
    let sfdxProjectRootPath = '';
    try {
      sfdxProjectRootPath = await SfProject.resolveProjectPath();
    } catch (error) {
      throw new Error(sharedMessages.getMessage('error.no-project', [(error as Error)?.message ?? '']));
    }
    const previewUrl = await selectedSite.getPreviewUrl();
    const username = connection.getUsername();
    if (!username) {
      throw new Error(sharedMessages.getMessage('error.username'));
    }

    this.log('Configuring local web server identity');
    const appServerIdentity = await PreviewUtils.getOrCreateAppServerIdentity(connection);
    const ldpServerToken = appServerIdentity.identityToken;
    const ldpServerId = appServerIdentity.usernameToServerEntityIdMap[username];
    if (!ldpServerId) {
      throw new Error(sharedMessages.getMessage('error.identitydata.entityid'));
    }

    this.log('Determining the next available port for Local Dev Server');
    const serverPorts = await PreviewUtils.getNextAvailablePorts();
    this.log(`Next available ports are http=${serverPorts.httpPort} , https=${serverPorts.httpsPort}`);

    this.log('Determining Local Dev Server url');
    const ldpServerUrl = PreviewUtils.generateWebSocketUrlForLocalDevServer(Platform.desktop, serverPorts);
    this.log(`Local Dev Server url is ${ldpServerUrl}`);

    const logger = await Logger.child(this.ctor.name);
    await startLWCServer(logger, sfdxProjectRootPath, ldpServerToken, Platform.desktop, serverPorts);
    const url = new URL(previewUrl);
    url.searchParams.set('aura.ldpServerUrl', ldpServerUrl);
    url.searchParams.set('aura.ldpServerId', ldpServerId);
    url.searchParams.set('lwc.mode', 'dev');
    await open(url.toString());
  }
}
