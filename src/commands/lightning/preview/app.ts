/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import path from 'node:path';
import * as readline from 'node:readline';
import { Logger, Messages } from '@salesforce/core';
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

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-lightning-dev', 'lightning.preview.app');

export const iOSSalesforceAppPreviewConfig = {
  name: 'Salesforce Mobile App',
  id: 'com.salesforce.chatter',
} as IOSAppPreviewConfig;

export const androidSalesforceAppPreviewConfig = {
  name: 'Salesforce Mobile App',
  id: 'com.salesforce.chatter',
  activity: 'com.salesforce.chatter.Chatter',
} as AndroidAppPreviewConfig;

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

  public static async waitForUserToInstallCert(
    platform: Platform.ios | Platform.android,
    device: IOSSimulatorDevice | AndroidVirtualDevice,
    certFilePath: string
  ): Promise<void> {
    let attention = `\n${messages.getMessage('certificate.attention')}`;
    attention = chalk.red(attention);
    // eslint-disable-next-line no-console
    console.log(attention);

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

    return LightningPreviewApp.waitForKeyPress();
  }

  private static async waitForKeyPress(): Promise<void> {
    return new Promise((resolve) => {
      // Emit keypress events on stdin
      readline.emitKeypressEvents(process.stdin);
      // Set stdin to raw mode
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }

      // eslint-disable-next-line no-console
      console.log(`\n${messages.getMessage('certificate.waiting')}\n`);

      // Function to handle key press
      function onKeyPress(): void {
        // Restore stdin settings
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(false);
        }
        process.stdin.removeListener('keypress', onKeyPress);
        process.stdin.pause();
        resolve();
      }

      // Add keypress listener
      process.stdin.on('keypress', onKeyPress);
    });
  }

  public async run(): Promise<void> {
    const { flags } = await this.parse(LightningPreviewApp);
    const logger = await Logger.child(this.ctor.name);

    await startLWCServer(process.cwd(), logger);

    const appName = flags['name'];
    const platform = flags['device-type'];
    const targetOrg = flags['target-org'];
    const deviceId = flags['device-id'];

    logger.debug('Determining Local Dev Server url');
    // todo: figure out how to make the port dynamic instead of hard-coded value here
    const ldpServerUrl = PreviewUtils.generateWebSocketUrlForLocalDevServer(platform, '8081');
    logger.debug(`Local Dev Server url is ${ldpServerUrl}`);

    let appId: string | undefined;
    if (appName) {
      logger.debug(`Determining App Id for ${appName}`);

      // The appName is optional but if the user did provide an appName then it must be
      // a valid one.... meaning that it should resolve to a valid appId.
      appId = await OrgUtils.getAppId(targetOrg.getConnection(undefined), appName);
      if (!appId) {
        return Promise.reject(new Error(messages.getMessage('error.fetching.app-id', [appName])));
      }

      logger.debug(`App Id is ${appId}`);
    }

    if (platform === Platform.desktop) {
      await this.desktopPreview(ldpServerUrl, appId, logger);
    } else {
      await this.mobilePreview(platform, ldpServerUrl, appName, appId, deviceId, logger);
    }
  }

  private async desktopPreview(ldpServerUrl: string, appId?: string, logger?: Logger): Promise<void> {
    if (!appId) {
      logger?.debug('No Lightning Experience application name provided.... using the default app instead.');
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

    const launchArguments = PreviewUtils.generateDesktopPreviewLaunchArguments(ldpServerUrl, appId, targetOrg);

    await this.config.runCommand('org:open', launchArguments);
  }

  private async mobilePreview(
    platform: Platform.ios | Platform.android,
    ldpServerUrl: string,
    appName?: string,
    appId?: string,
    deviceId?: string,
    logger?: Logger
  ): Promise<void> {
    try {
      // 1. Verify that user environment is set up for mobile (i.e. has right tooling)
      await this.verifyMobileRequirements(platform, logger);

      // 2. Fetch the target device
      const device = await PreviewUtils.getMobileDevice(platform, deviceId, logger);
      if (!device) {
        throw new Error(messages.getMessage('error.device.notfound', [deviceId ?? '']));
      }

      // 3. Boot the device if not already booted
      this.spinner.start(messages.getMessage('spinner.device.boot', [device.toString()]));
      const resolvedDeviceId = platform === Platform.ios ? (device as IOSSimulatorDevice).udid : device.name;
      const emulatorPort = await PreviewUtils.bootMobileDevice(platform, resolvedDeviceId, logger);
      this.spinner.stop();

      // 4. Generate self-signed certificate and wait for user to install it
      // TODO: update the save location to be the same as server config file path
      this.spinner.start(messages.getMessage('spinner.cert.gen'));
      const certFilePath = PreviewUtils.generateSelfSignedCert(platform, '~/Desktop/cert');
      this.spinner.stop();
      await LightningPreviewApp.waitForUserToInstallCert(platform, device, certFilePath);

      // 5. Check if Salesforce Mobile App is installed on the device
      const appConfig = platform === Platform.ios ? iOSSalesforceAppPreviewConfig : androidSalesforceAppPreviewConfig;
      const appInstalled = await PreviewUtils.verifyMobileAppInstalled(
        platform,
        appConfig,
        resolvedDeviceId,
        emulatorPort,
        logger
      );

      // 6. If Salesforce Mobile App is not installed, download and install it
      let bundlePath: string | undefined;
      if (!appInstalled) {
        const maxInt32 = 2_147_483_647; // maximum 32-bit signed integer value
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

      // 7. Launch the native app for previewing (launchMobileApp will show its own spinner)
      // eslint-disable-next-line camelcase
      appConfig.launch_arguments = PreviewUtils.generateMobileAppPreviewLaunchArguments(ldpServerUrl, appName, appId);
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
  private async verifyMobileRequirements(platform: Platform.ios | Platform.android, logger?: Logger): Promise<void> {
    logger?.debug(`Verifying environment meets requirements for previewing on ${platform}`);

    const setupCommand = new LwcDevMobileCoreSetup(['-p', platform], this.config);
    await setupCommand.init();
    await setupCommand.run();

    logger?.debug('Requirements are met'); // if we make it here then all is good
  }
}
