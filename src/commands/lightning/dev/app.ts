/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import path from 'node:path';
import * as readline from 'node:readline';
import { Connection, Logger, Messages, SfProject } from '@salesforce/core';
import {
  AndroidAppPreviewConfig,
  AndroidVirtualDevice,
  IOSAppPreviewConfig,
  IOSSimulatorDevice,
  Setup as LwcDevMobileCoreSetup,
  Platform,
} from '@salesforce/lwc-dev-mobile-core';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import chalk from 'chalk';
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

  private static async waitForKeyPress(): Promise<void> {
    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      // eslint-disable-next-line no-console
      console.log(`\n${messages.getMessage('certificate.waiting')}\n`);

      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.once('data', () => {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        rl.close();
        resolve();
      });
    });
  }

  public async waitForUserToInstallCert(
    platform: Platform.ios | Platform.android,
    device: IOSSimulatorDevice | AndroidVirtualDevice,
    certFilePath: string
  ): Promise<void> {
    // eslint-disable-next-line no-console
    console.log(`\n${messages.getMessage('certificate.installation.notice')}`);

    const skipInstall = await this.confirm({
      message: messages.getMessage('certificate.installation.skip.message'),
      defaultAnswer: true,
      ms: maxInt32, // simulate no timeout and wait for user to answer
    });

    if (skipInstall) {
      return;
    }

    let installationSteps = '';
    if (platform === Platform.ios) {
      installationSteps = messages.getMessage('certificate.installation.steps.ios');
    } else {
      const apiLevel = (device as AndroidVirtualDevice).apiLevel.toString();

      let subStepMessageKey = '';
      if (apiLevel.startsWith('24.') || apiLevel.startsWith('25.')) {
        subStepMessageKey = 'certificate.installation.steps.android.nav-target-api-24-25';
      } else if (apiLevel.startsWith('26.') || apiLevel.startsWith('27.')) {
        subStepMessageKey = 'certificate.installation.steps.android.nav-target-api-26-27';
      } else if (apiLevel.startsWith('28.')) {
        subStepMessageKey = 'certificate.installation.steps.android.nav-target-api-28';
      } else if (apiLevel.startsWith('29.')) {
        subStepMessageKey = 'certificate.installation.steps.android.nav-target-api-29';
      } else if (apiLevel.startsWith('30.') || apiLevel.startsWith('31.') || apiLevel.startsWith('32.')) {
        subStepMessageKey = 'certificate.installation.steps.android.nav-target-api-30-32';
      } else if (apiLevel.startsWith('33.')) {
        subStepMessageKey = 'certificate.installation.steps.android.nav-target-api-33';
      } else {
        subStepMessageKey = 'certificate.installation.steps.android.nav-target-api-34-up';
      }

      installationSteps = messages.getMessage('certificate.installation.steps.android', [
        messages.getMessage(subStepMessageKey),
      ]);
    }

    let message = messages.getMessage('certificate.installation.description', [certFilePath, installationSteps]);

    // use chalk to format every substring wrapped in `` so they would stand out when printed on screen
    message = message.replace(/`([^`]*)`/g, chalk.yellow('$1'));

    // eslint-disable-next-line no-console
    console.log(message);

    return LightningDevApp.waitForKeyPress();
  }

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
    await startLWCServer(logger, sfdxProjectRootPath, token, Platform.desktop, serverPorts);

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

      // Boot the device if not already booted
      this.spinner.start(messages.getMessage('spinner.device.boot', [device.toString()]));
      const resolvedDeviceId = platform === Platform.ios ? (device as IOSSimulatorDevice).udid : device.name;
      const emulatorPort = await PreviewUtils.bootMobileDevice(platform, resolvedDeviceId, logger);
      this.spinner.stop();

      // Configure certificates for dev server secure connection
      this.spinner.start(messages.getMessage('spinner.cert.gen'));
      const { certData, certFilePath } = await PreviewUtils.generateSelfSignedCert(platform, sfdxProjectRootPath);
      this.spinner.stop();

      // Show message and wait for user to install the certificate on their device
      await this.waitForUserToInstallCert(platform, device, certFilePath);

      // Check if Salesforce Mobile App is installed on the device
      const appConfig = platform === Platform.ios ? iOSSalesforceAppPreviewConfig : androidSalesforceAppPreviewConfig;
      const appInstalled = await PreviewUtils.verifyMobileAppInstalled(
        platform,
        appConfig,
        resolvedDeviceId,
        emulatorPort,
        logger
      );

      // If Salesforce Mobile App is not installed, download and install it
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
          await PreviewUtils.extractZIPArchive(bundlePath, outputDir, logger);
          this.spinner.stop();
          bundlePath = finalBundlePath;
        }
      }

      // Start the LWC Dev Server

      await startLWCServer(logger, sfdxProjectRootPath, token, platform, serverPorts, certData);

      // Launch the native app for previewing (launchMobileApp will show its own spinner)
      // eslint-disable-next-line camelcase
      appConfig.launch_arguments = PreviewUtils.generateMobileAppPreviewLaunchArguments(
        ldpServerUrl,
        entityId,
        appName,
        appId
      );
      await PreviewUtils.launchMobileApp(platform, appConfig, resolvedDeviceId, emulatorPort, bundlePath, logger);
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
