/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import path from 'node:path';
import { Connection, Logger, Messages, SfProject } from '@salesforce/core';
import {
  AndroidAppPreviewConfig,
  AndroidDevice,
  CommonUtils,
  IOSAppPreviewConfig,
  Setup as LwcDevMobileCoreSetup,
  Platform,
} from '@salesforce/lwc-dev-mobile-core';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { OrgUtils } from '../../../shared/orgUtils.js';
import { startLWCServer } from '../../../lwc-dev-server/index.js';
import { PreviewUtils } from '../../../shared/previewUtils.js';
import { ConfigUtils, IdentityTokenService } from '../../../shared/configUtils.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-lightning-dev', 'lightning.dev.app');

export const iOSSalesforceAppPreviewConfig = {
  name: 'Salesforce Mobile App',
  id: 'com.salesforce.chatter',
} as IOSAppPreviewConfig;

export const androidSalesforceAppPreviewConfig = {
  name: 'Salesforce Mobile App',
  id: 'com.salesforce.chatter',
  activity: 'com.salesforce.chatter.Chatter',
} as AndroidAppPreviewConfig;

const maxInt32 = 2_147_483_647; // maximum 32-bit signed integer value

class AppServerIdentityTokenService implements IdentityTokenService {
  private connection: Connection;
  public constructor(connection: Connection) {
    this.connection = connection;
  }

  public async saveTokenToServer(token: string): Promise<string> {
    const sobject = this.connection.sobject('UserLocalWebServerIdentity');
    const result = await sobject.insert({ LocalWebServerIdentityToken: token });
    if (result.success) {
      return result.id;
    }
    throw new Error('Could not save the token to the server');
  }
}

export default class LightningDevApp extends SfCommand<void> {
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
    const { flags } = await this.parse(LightningDevApp);
    const logger = await Logger.child(this.ctor.name);

    const appName = flags['name'];
    const platform = flags['device-type'];
    const targetOrg = flags['target-org'];
    const deviceId = flags['device-id'];

    let sfdxProjectRootPath = '';
    try {
      sfdxProjectRootPath = await SfProject.resolveProjectPath();
    } catch (error) {
      return Promise.reject(new Error(messages.getMessage('error.no-project', [(error as Error)?.message ?? ''])));
    }

    logger.debug('Configuring local web server identity');
    const connection = targetOrg.getConnection(undefined);
    const username = connection.getUsername();
    if (!username) {
      return Promise.reject(new Error(messages.getMessage('error.username')));
    }

    const tokenService = new AppServerIdentityTokenService(connection);
    const token = await ConfigUtils.getOrCreateIdentityToken(username, tokenService);

    let appId: string | undefined;
    if (appName) {
      logger.debug(`Determining App Id for ${appName}`);

      // The appName is optional but if the user did provide an appName then it must be
      // a valid one.... meaning that it should resolve to a valid appId.
      appId = await OrgUtils.getAppId(connection, appName);
      if (!appId) {
        return Promise.reject(new Error(messages.getMessage('error.fetching.app-id', [appName])));
      }

      logger.debug(`App Id is ${appId}`);
    }

    logger.debug('Determining the next available port for Local Dev Server');
    const serverPorts = await PreviewUtils.getNextAvailablePorts();
    logger.debug(`Next available ports are http=${serverPorts.httpPort} , https=${serverPorts.httpsPort}`);

    logger.debug('Determining Local Dev Server url');
    const ldpServerUrl = PreviewUtils.generateWebSocketUrlForLocalDevServer(platform, serverPorts, logger);
    logger.debug(`Local Dev Server url is ${ldpServerUrl}`);

    const entityId = await PreviewUtils.getEntityId(username);

    if (platform === Platform.desktop) {
      await this.desktopPreview(sfdxProjectRootPath, serverPorts, token, entityId, ldpServerUrl, appId, logger);
    } else {
      await this.mobilePreview(
        platform,
        sfdxProjectRootPath,
        serverPorts,
        token,
        entityId,
        ldpServerUrl,
        appName,
        appId,
        deviceId,
        logger
      );
    }
  }

  private async desktopPreview(
    sfdxProjectRootPath: string,
    serverPorts: { httpPort: number; httpsPort: number },
    token: string,
    entityId: string,
    ldpServerUrl: string,
    appId: string | undefined,
    logger: Logger
  ): Promise<void> {
    if (!appId) {
      logger.debug('No Lightning Experience application name provided.... using the default app instead.');
    }

    // There are various ways to pass in a target org (as an alias, as a username, etc).
    // We could have LightningPreviewApp parse its --target-org flag which will be resolved
    // to an Org object (see https://github.com/forcedotcom/sfdx-core/blob/main/src/org/org.ts)
    // then write a bunch of code to look at this Org object to try to determine whether
    // it was initialized using Alias, Username, etc. and get a string representation of the
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
    let targetOrg: string | undefined;
    if (idx >= 0 && idx < this.argv.length - 1) {
      targetOrg = this.argv[idx + 1];
    }

    if (ldpServerUrl.startsWith('wss')) {
      this.log(`\n${messages.getMessage('trust.local.dev.server')}`);
    }

    const launchArguments = PreviewUtils.generateDesktopPreviewLaunchArguments(
      ldpServerUrl,
      entityId,
      appId,
      targetOrg
    );

    // Start the LWC Dev Server
    await startLWCServer(logger, sfdxProjectRootPath, token, serverPorts);

    // Open the browser and navigate to the right page
    await this.config.runCommand('org:open', launchArguments);
  }

  private async mobilePreview(
    platform: Platform.ios | Platform.android,
    sfdxProjectRootPath: string,
    serverPorts: { httpPort: number; httpsPort: number },
    token: string,
    entityId: string,
    ldpServerUrl: string,
    appName: string | undefined,
    appId: string | undefined,
    deviceId: string | undefined,
    logger: Logger
  ): Promise<void> {
    try {
      // Verify that user environment is set up for mobile (i.e. has right tooling)
      await this.verifyMobileRequirements(platform, logger);

      // Fetch the target device
      const device = await PreviewUtils.getMobileDevice(platform, deviceId, logger);
      if (!device) {
        throw new Error(messages.getMessage('error.device.notfound', [deviceId ?? '']));
      }

      if ((device as AndroidDevice)?.isPlayStore === true) {
        throw new Error(
          `Google Play devices are not supported. ${device.id} is a Google Play device. Please use a Google APIs device instead.`
        );
      }

      // Boot the device. If device is already booted then this will immediately return anyway.
      this.spinner.start(messages.getMessage('spinner.device.boot', [device.toString()]));
      await device.boot();
      this.spinner.stop();

      // Configure certificates for dev server secure connection
      this.spinner.start(messages.getMessage('spinner.cert.gen'));
      const certData = await PreviewUtils.generateSelfSignedCert();
      this.spinner.stop();

      // Automatically install the certificate on the device.
      this.spinner.start(messages.getMessage('spinner.cert.install'));
      if (platform === Platform.ios) {
        // On iOS we force-install the cert even if it is already installed because
        // the process of installing the cert is fast and easy.
        await device.installCert(certData);
      } else {
        // On Android the process of auto-installing a cert is a bit involved and slow.
        // So it is best to first determine if the cert is already installed or not.
        const isAlreadyInstalled = await device.isCertInstalled(certData);
        if (!isAlreadyInstalled) {
          await device.installCert(certData);
        }
      }
      this.spinner.stop();

      // Check if Salesforce Mobile App is installed on the device
      const appConfig = platform === Platform.ios ? iOSSalesforceAppPreviewConfig : androidSalesforceAppPreviewConfig;
      const appInstalled = await device.hasApp(appConfig.id);

      // If Salesforce Mobile App is not installed, offer to download and install it
      let bundlePath: string | undefined;
      if (!appInstalled) {
        const proceedWithDownload = await this.confirm({
          message: messages.getMessage('mobileapp.download', [appConfig.name]),
          defaultAnswer: false,
          ms: maxInt32, // simulate no timeout and wait for user to answer
        });

        if (!proceedWithDownload) {
          throw new Error(messages.getMessage('mobileapp.notfound', [appConfig.name]));
        }

        // downloadSalesforceMobileAppBundle() will show a progress bar
        bundlePath = await PreviewUtils.downloadSalesforceMobileAppBundle(
          platform,
          logger,
          this.spinner,
          this.progress
        );

        // on iOS the bundle comes as a ZIP archive so we need to extract it first
        if (platform === Platform.ios) {
          this.spinner.start(messages.getMessage('spinner.extract.archive'));
          const outputDir = path.dirname(bundlePath);
          const finalBundlePath = path.join(outputDir, 'Chatter.app');
          await CommonUtils.extractZIPArchive(bundlePath, outputDir, logger);
          this.spinner.stop();
          bundlePath = finalBundlePath;
        }
      }

      // Start the LWC Dev Server

      await startLWCServer(logger, sfdxProjectRootPath, token, serverPorts, certData);

      // Launch the native app for previewing (launchMobileApp will show its own spinner)
      // eslint-disable-next-line camelcase
      appConfig.launch_arguments = PreviewUtils.generateMobileAppPreviewLaunchArguments(
        ldpServerUrl,
        entityId,
        appName,
        appId
      );
      const targetActivity = (appConfig as AndroidAppPreviewConfig)?.activity;
      const targetApp = targetActivity ? `${appConfig.id}/${targetActivity}` : appConfig.id;

      await device.launchApp(targetApp, bundlePath, appConfig.launch_arguments ?? []);
    } finally {
      // stop progress & spinner UX (that may still be running in case of an error)
      this.progress.stop();
      this.spinner.stop();
    }
  }

  /**
   * In order to preview on mobile, the user's environment should meet certain requirements
   * (such as having the right mobile tooling installed). This method verifies that these
   * requirements are met.
   *
   * @param platform A mobile platform (iOS or Android)
   * @param logger An optional logger to be used for logging
   */
  private async verifyMobileRequirements(platform: Platform.ios | Platform.android, logger: Logger): Promise<void> {
    logger.debug(`Verifying environment meets requirements for previewing on ${platform}`);

    const setupCommand = new LwcDevMobileCoreSetup(['-p', platform], this.config);
    await setupCommand.init();
    await setupCommand.run();

    logger.debug('Requirements are met'); // if we make it here then all is good
  }
}
