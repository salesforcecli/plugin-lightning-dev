/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import path from 'node:path';
import { Logger, Messages, SfProject } from '@salesforce/core';
import {
  AndroidAppPreviewConfig,
  AndroidDevice,
  BootMode,
  CommonUtils,
  IOSAppPreviewConfig,
  Setup as LwcDevMobileCoreSetup,
  Platform,
} from '@salesforce/lwc-dev-mobile-core';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { startLWCServer } from '../../../lwc-dev-server/index.js';
import { PreviewUtils } from '../../../shared/previewUtils.js';
import { PromptUtils } from '../../../shared/promptUtils.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-lightning-dev', 'lightning.dev.app');
const sharedMessages = Messages.loadMessages('@salesforce/plugin-lightning-dev', 'shared.utils');

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
    })(),
    'device-id': Flags.string({
      summary: messages.getMessage('flags.device-id.summary'),
      char: 'i',
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(LightningDevApp);
    const logger = await Logger.child(this.ctor.name);

    const targetOrg = flags['target-org'];
    const appName = flags['name'];
    const deviceId = flags['device-id'];

    let sfdxProjectRootPath = '';
    try {
      sfdxProjectRootPath = await SfProject.resolveProjectPath();
    } catch (error) {
      return Promise.reject(
        new Error(sharedMessages.getMessage('error.no-project', [(error as Error)?.message ?? '']))
      );
    }

    logger.debug('Initalizing preview connection and configuring local web server identity');
    const { connection, ldpServerId, ldpServerToken } = await PreviewUtils.initializePreviewConnection(targetOrg);

    const platform = flags['device-type'] ?? (await PromptUtils.promptUserToSelectPlatform());

    const appId = await PreviewUtils.getLightningExperienceAppId(connection, appName, logger);

    logger.debug('Determining the next available port for Local Dev Server');
    const serverPorts = await PreviewUtils.getNextAvailablePorts();
    logger.debug(`Next available ports are http=${serverPorts.httpPort} , https=${serverPorts.httpsPort}`);

    logger.debug('Determining Local Dev Server url');
    const ldpServerUrl = PreviewUtils.generateWebSocketUrlForLocalDevServer(platform, serverPorts, logger);
    logger.debug(`Local Dev Server url is ${ldpServerUrl}`);

    if (platform === Platform.desktop) {
      await this.desktopPreview(
        sfdxProjectRootPath,
        serverPorts,
        ldpServerToken,
        ldpServerId,
        ldpServerUrl,
        appId,
        logger
      );
    } else {
      await this.mobilePreview(
        platform,
        sfdxProjectRootPath,
        serverPorts,
        ldpServerToken,
        ldpServerId,
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
    ldpServerToken: string,
    ldpServerId: string,
    ldpServerUrl: string,
    appId: string | undefined,
    logger: Logger
  ): Promise<void> {
    if (!appId) {
      logger.debug('No Lightning Experience application name provided.... using the default app instead.');
    }

    const targetOrg = PreviewUtils.getTargetOrgFromArguments(this.argv);

    if (ldpServerUrl.startsWith('wss')) {
      this.log(`\n${messages.getMessage('trust.local.dev.server')}`);
    }

    const launchArguments = PreviewUtils.generateDesktopPreviewLaunchArguments(
      ldpServerUrl,
      ldpServerId,
      appId,
      targetOrg
    );

    // Start the LWC Dev Server
    await startLWCServer(logger, sfdxProjectRootPath, ldpServerToken, Platform.desktop, serverPorts);

    // Open the browser and navigate to the right page
    await this.config.runCommand('org:open', launchArguments);
  }

  private async mobilePreview(
    platform: Platform.ios | Platform.android,
    sfdxProjectRootPath: string,
    serverPorts: { httpPort: number; httpsPort: number },
    ldpServerToken: string,
    ldpServerId: string,
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
        throw new Error(messages.getMessage('error.device.google.play', [device.id]));
      }

      // Boot the device. If device is already booted then this will immediately return anyway.
      this.spinner.start(messages.getMessage('spinner.device.boot', [device.toString()]));
      if (platform === Platform.ios) {
        await device.boot();
      } else {
        // Prefer to boot the AVD with system writable. If it is already booted then calling boot()
        // will have no effect. But if an AVD is not already booted then this will perform a cold
        // boot with writable system. This way later on when we want to install cert on the device,
        // we won't need to shut it down and reboot it with writable system since it already will
        // have writable system, thus speeding up the process of installing a cert.
        await (device as AndroidDevice).boot(true, BootMode.systemWritablePreferred, false);
      }
      this.spinner.stop();

      // Configure certificates for dev server secure connection
      const certData = await PreviewUtils.generateSelfSignedCert();
      if (platform === Platform.ios) {
        // On iOS we force-install the cert even if it is already installed because
        // the process of installing the cert is fast and easy.
        this.spinner.start(messages.getMessage('spinner.cert.install'));
        await device.installCert(certData);
        this.spinner.stop();
      } else {
        // On Android the process of auto-installing a cert is a bit involved and slow.
        // So it is best to first determine if the cert is already installed or not.
        const isAlreadyInstalled = await device.isCertInstalled(certData);
        if (!isAlreadyInstalled) {
          this.spinner.start(messages.getMessage('spinner.cert.install'));
          await device.installCert(certData);
          this.spinner.stop();
        }
      }

      // Check if Salesforce Mobile App is installed on the device
      const appConfig = platform === Platform.ios ? iOSSalesforceAppPreviewConfig : androidSalesforceAppPreviewConfig;
      const appInstalled = await device.isAppInstalled(appConfig.id);

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

        // now go ahead and install the app
        this.spinner.start(messages.getMessage('spinner.app.install', [appConfig.id]));
        await device.installApp(bundlePath);
        this.spinner.stop();
      }

      // Start the LWC Dev Server
      await startLWCServer(logger, sfdxProjectRootPath, ldpServerToken, platform, serverPorts, certData);

      // Launch the native app for previewing (launchMobileApp will show its own spinner)
      // eslint-disable-next-line camelcase
      appConfig.launch_arguments = PreviewUtils.generateMobileAppPreviewLaunchArguments(
        ldpServerUrl,
        ldpServerId,
        appName,
        appId
      );
      const targetActivity = (appConfig as AndroidAppPreviewConfig)?.activity;
      const targetApp = targetActivity ? `${appConfig.id}/${targetActivity}` : appConfig.id;

      await device.launchApp(targetApp, appConfig.launch_arguments ?? []);
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
