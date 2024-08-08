/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// **********************************************************************************************
// * TODO: When we finalize the implementation for the dev commands and things settle down, *
// *       consider moving most of these into PreviewUtils of lwc-dev-mobile-core instead.      *
// **********************************************************************************************

import fs from 'node:fs';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import { Logger, Messages } from '@salesforce/core';
import {
  AndroidAppPreviewConfig,
  AndroidUtils,
  AndroidVirtualDevice,
  CommonUtils,
  CryptoUtils,
  IOSAppPreviewConfig,
  IOSSimulatorDevice,
  IOSUtils,
  LaunchArgument,
  PreviewUtils as LwcDevMobileCorePreviewUtils,
  Platform,
  SSLCertificateData,
} from '@salesforce/lwc-dev-mobile-core';
import { Progress, Spinner } from '@salesforce/sf-plugins-core';
import fetch from 'node-fetch';
import { ConfigUtils, LOCAL_DEV_SERVER_DEFAULT_HTTP_PORT } from './configUtils.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-lightning-dev', 'lightning.dev.app');
const DevPreviewAuraMode = 'DEVPREVIEW';

export class PreviewUtils {
  public static generateWebSocketUrlForLocalDevServer(
    platform: string,
    ports: { httpPort: number; httpsPort: number },
    logger?: Logger
  ): string {
    return LwcDevMobileCorePreviewUtils.generateWebSocketUrlForLocalDevServer(platform, ports, logger);
  }

  /**
   * Returns a pair of port numbers to be used by the local dev server for http and https.
   *
   * It starts by checking whether the user has configured a port in their config file.
   * If so then we are only allowed to use that port, regardless of whether it is in use
   * or not.
   *
   * If the user has not configured a port in their config file then we are free to choose
   * one. We'll start with the default port (8081) and checks to see if it is in use or not.
   * If it is in use then we increment the port number by 2 and check if it is in use or not.
   * This process is repeated until a port that is not in use is found.
   *
   * @returns a pair of port numbers to be used by the local dev server for http and https.
   */
  public static async getNextAvailablePorts(): Promise<{ httpPort: number; httpsPort: number }> {
    const userConfiguredPorts = await ConfigUtils.getLocalDevServerPorts();

    if (userConfiguredPorts) {
      return Promise.resolve(userConfiguredPorts);
    }

    const httpPort = await this.doGetNextAvailablePort(LOCAL_DEV_SERVER_DEFAULT_HTTP_PORT);
    const httpsPort = await this.doGetNextAvailablePort(httpPort + 1);

    return Promise.resolve({ httpPort, httpsPort });
  }

  /**
   * Attempts to fetch the targeted mobile device for previewing.
   *
   * @param platform A mobile platform (iOS or Android)
   * @param deviceId An optional device identifier (such as name or UDID)
   * @param logger An optional logger to be used for logging
   * @returns The iOS or Android device, or `undefined` if not found
   */
  public static async getMobileDevice(
    platform: Platform.ios | Platform.android,
    deviceId?: string,
    logger?: Logger
  ): Promise<IOSSimulatorDevice | AndroidVirtualDevice | undefined> {
    let device: IOSSimulatorDevice | AndroidVirtualDevice | undefined;

    logger?.debug(`Attempting to get mobile device for platform ${platform}`);

    if (deviceId) {
      logger?.debug(`Attempting to get device ${deviceId}`);
      device =
        platform === Platform.ios
          ? (await IOSUtils.getSimulator(deviceId, logger)) ?? undefined
          : await AndroidUtils.fetchEmulator(deviceId, logger);
    } else {
      logger?.debug('No particular device was targeted by the user...  fetching the first available device.');
      const devices =
        platform === Platform.ios
          ? await IOSUtils.getSupportedSimulators(logger)
          : await AndroidUtils.fetchEmulators(logger);
      if (devices && devices.length > 0) {
        device = devices[0];
      }
    }

    return Promise.resolve(device);
  }

  /**
   * Attempts to boot a device.
   *
   * @param platform A mobile platform (iOS or Android)
   * @param deviceId The identifier (such as name or UDID) of the target device
   * @param logger An optional logger to be used for logging
   * @returns For Android devices returns the emulator port number. For iOS devices returns `undefined`
   */
  public static async bootMobileDevice(
    platform: Platform.ios | Platform.android,
    deviceId: string,
    logger?: Logger
  ): Promise<number | undefined> {
    logger?.debug(`Booting device ${deviceId}`);

    let emulatorPort: number | undefined;

    if (platform === Platform.ios) {
      await IOSUtils.bootDevice(deviceId, true, logger); // will be no-op if already booted
      await IOSUtils.launchSimulatorApp(logger);
      logger?.debug('Device booted');
    } else {
      emulatorPort = await AndroidUtils.startEmulator(deviceId, false, true, logger); // will be no-op if already booted
      logger?.debug(`Device booted on port ${emulatorPort}`);
    }

    return Promise.resolve(emulatorPort);
  }

  /**
   * Generates the proper set of arguments to be used for launching desktop browser and navigating to the right location.
   *
   * @param ldpServerUrl The URL for the local dev server
   * @param entityId Record ID for the identity token
   * @param appId An optional app id for a targeted LEX app
   * @param targetOrg An optional org id
   * @param auraMode An optional Aura Mode (defaults to DEVPREVIEW)
   * @returns Array of arguments to be used by Org:Open command for launching desktop browser
   */
  public static generateDesktopPreviewLaunchArguments(
    ldpServerUrl: string,
    entityId: string,
    appId?: string,
    targetOrg?: string,
    auraMode = DevPreviewAuraMode
  ): string[] {
    // appPath will resolve to one of the following:
    //
    //   lightning/app/<appId> => when the user is targeting a specific LEX app
    //               lightning => when the user is not targeting a specific LEX app
    //
    const appPath = appId ? `lightning/app/${appId}` : 'lightning';

    // we prepend a '0.' to all of the params to ensure they will persist across browser redirects
    const launchArguments = [
      '--path',
      `${appPath}?0.aura.ldpServerUrl=${ldpServerUrl}&0.aura.ldpServerId=${entityId}&0.aura.mode=${auraMode}`,
    ];

    if (targetOrg) {
      launchArguments.push('--target-org', targetOrg);
    }

    return launchArguments;
  }

  /**
   * Generates the proper set of arguments to be used for launching a mobile app with custom launch arguments.
   *
   * @param ldpServerUrl The URL for the local dev server
   * @param entityId Record ID for the identity token
   * @param appName An optional app name for a targeted LEX app
   * @param appId An optional app id for a targeted LEX app
   * @param auraMode An optional Aura Mode (defaults to DEVPREVIEW)
   * @returns Array of arguments to be used as custom launch arguments when launching a mobile app.
   */
  public static generateMobileAppPreviewLaunchArguments(
    ldpServerUrl: string,
    entityId: string,
    appName?: string,
    appId?: string,
    auraMode = DevPreviewAuraMode
  ): LaunchArgument[] {
    const launchArguments: LaunchArgument[] = [];

    if (appName) {
      launchArguments.push({ name: 'LightningExperienceAppName', value: appName });
    }

    if (appId) {
      launchArguments.push({ name: 'LightningExperienceAppID', value: appId });
    }

    launchArguments.push({ name: 'aura.ldpServerUrl', value: ldpServerUrl });

    launchArguments.push({ name: 'aura.mode', value: auraMode });

    launchArguments.push({ name: 'aura.ldpServerId', value: entityId });

    return launchArguments;
  }

  /**
   * Generates a self-signed certificate and saves it to a file at the specified location.
   *
   * @param platform A mobile platform (iOS or Android)
   * @param saveLocation Path to a folder where the generated certificated will be saved to (defaults to the current working directory)
   * @returns Path to the generated certificate file and the certificate data
   */
  public static async generateSelfSignedCert(
    platform: Platform.ios | Platform.android,
    saveLocation = '.'
  ): Promise<{ certData: SSLCertificateData; certFilePath: string }> {
    // See if we have previously generated cert data which is stored in the global config.
    // If so then use that data otherwise generate new cert data and store it in the global config.
    let data = await ConfigUtils.getCertData();
    if (!data) {
      data = CryptoUtils.generateSelfSignedCert('localhost', 2048, 820);
      await ConfigUtils.writeCertData(data);
    }

    const basePath = path.resolve(CommonUtils.resolveUserHomePath(saveLocation));

    const targetFile =
      platform === Platform.ios ? path.join(basePath, 'localhost.der') : path.join(basePath, 'localhost.pem');

    // save to file
    if (platform === Platform.ios) {
      fs.writeFileSync(targetFile, data.derCertificate);
    } else {
      fs.writeFileSync(targetFile, data.pemCertificate);
    }

    return { certData: data, certFilePath: targetFile };
  }

  /**
   * Launches the specified mobile app on the specified device.
   *
   * @param platform A mobile platform (iOS or Android)
   * @param deviceId The identifier (such as name or UDID) of the target device
   * @param appConfig The app configuration containing info about the mobile app to be launched
   * @param emulatorPort Optional - only needed when platform is Android and specifies the ADB port of the booted Android virtual device
   * @param logger An optional logger to be used for logging
   */
  public static async launchMobileApp(
    platform: Platform.ios | Platform.android,
    appConfig: IOSAppPreviewConfig | AndroidAppPreviewConfig,
    deviceId: string,
    emulatorPort?: number,
    appBundlePath?: string,
    logger?: Logger
  ): Promise<void> {
    logger?.debug(`Attempting to launch mobile app ${appConfig.name}`);

    // If appBundlePath is provided then the app will be installed from
    // the bundle first then will be launched. Otherwise the assumption
    // is that app is already installed.
    if (platform === Platform.ios) {
      await IOSUtils.launchAppInBootedSimulator(
        deviceId,
        appBundlePath,
        appConfig.id,
        appConfig.launch_arguments ?? [],
        logger
      );
    } else if (emulatorPort) {
      // for Android, emulatorPort is required
      await AndroidUtils.launchAppInBootedEmulator(
        appBundlePath,
        appConfig.id,
        appConfig.launch_arguments ?? [],
        (appConfig as AndroidAppPreviewConfig).activity,
        emulatorPort,
        logger
      );
    }
  }

  /**
   * Verifies whether a particular app is installed on a mobile device.
   *
   * @param platform A mobile platform (iOS or Android)
   * @param appConfig The app configuration containing info about the mobile app such as name and bundle/package id
   * @param deviceId The identifier (such as name or UDID) of the target device
   * @param emulatorPort Optional - only needed when platform is Android and specifies the ADB port of the booted Android virtual device
   * @param logger An optional logger to be used for logging
   * @returns `true` if app is installed, `false` otherwise
   */
  public static async verifyMobileAppInstalled(
    platform: Platform.ios | Platform.android,
    appConfig: IOSAppPreviewConfig | AndroidAppPreviewConfig,
    deviceId: string,
    emulatorPort?: number,
    logger?: Logger
  ): Promise<boolean> {
    logger?.debug(`Checking if ${appConfig.id} is installed on device ${deviceId}`);
    let result = '';
    try {
      if (platform === Platform.ios) {
        result = CommonUtils.executeCommandSync(
          `xcrun simctl listapps ${deviceId} | grep "${appConfig.id}"`,
          undefined,
          logger
        );
      } else {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const resolvedEmulatorPort = emulatorPort!;
        result = await AndroidUtils.executeAdbCommand(
          `shell pm list packages | grep "${appConfig.id}"`,
          resolvedEmulatorPort,
          logger
        );
      }
    } catch {
      /* ignore and continue */
    }

    return Promise.resolve(result ? true : false);
  }

  /**
   * Downloads the Salesforce Mobile App into a temp folder and returns the path to downloaded file.
   *
   * @param platform A mobile platform (iOS or Android)
   * @param logger An optional logger to be used for logging
   * @param progress An optional spinner indicator for reporting messages
   * @param progress An optional progress indicator for reporting progress
   * @returns The path to downloaded file.
   */
  public static async downloadSalesforceMobileAppBundle(
    platform: Platform.ios | Platform.android,
    logger?: Logger,
    spinner?: Spinner,
    progress?: Progress
  ): Promise<string> {
    const sfdcUrl =
      platform === Platform.ios
        ? 'https://sfdc.co/salesforce-mobile-app-ios-simulator'
        : 'https://sfdc.co/salesforce-mobile-app-android-emulator';

    let fullUrl = '';
    try {
      spinner?.start(messages.getMessage('spinner.download.preparing'));
      logger?.debug(`Attempting to resolve full url from ${sfdcUrl}`);
      fullUrl = await this.fetchFullUrlFromSfdc(sfdcUrl);
      logger?.debug(`Full url is ${fullUrl}`);
    } finally {
      spinner?.stop();
    }

    const parsedUrl = new URL(fullUrl);
    const pathname = parsedUrl.pathname;
    const filename = path.basename(pathname);
    const tempDir = os.tmpdir();
    const downloadedFilePath = path.join(tempDir, filename);

    if (fs.existsSync(downloadedFilePath)) {
      logger?.debug(`Skip downloading because already downloaded to ${downloadedFilePath}`);
      return Promise.resolve(downloadedFilePath);
    }

    logger?.debug(`Attempting to download from ${fullUrl} to ${downloadedFilePath}`);
    const response = await fetch(fullUrl, { redirect: 'follow' });
    if (!response.ok) {
      return Promise.reject(new Error(response.statusText));
    }

    const totalSize = parseInt(response.headers.get('content-length') ?? '0', 10);
    let downloadedSize = 0;

    // Create a write stream to save the file
    const fileStream = fs.createWriteStream(downloadedFilePath);

    // If we can determine the expected total size then we can report progress
    if (totalSize) {
      progress?.start(100, undefined, {
        title: messages.getMessage('spinner.downloading'),
        format: '%s | {bar} | {percentage}%',
      });
    } else {
      spinner?.start(messages.getMessage('spinner.downloading'));
    }

    return new Promise((resolve, reject) => {
      if (progress && totalSize) {
        response.body?.on('data', (chunk) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          downloadedSize += chunk.length;
          const percentage = parseFloat(Math.min((downloadedSize / totalSize) * 100, 100).toFixed(1));
          progress.update(percentage);
        });
      }

      response.body?.pipe(fileStream);

      response.body?.on('error', (err) => {
        // on error, delete the partially downloaded file
        try {
          fs.rmSync(downloadedFilePath);
        } catch {
          /* ignore and continue */
        }
        progress?.stop();
        spinner?.stop();
        reject(err);
      });

      fileStream.on('finish', () => {
        progress?.finish();
        spinner?.stop();
        resolve(downloadedFilePath);
      });
    });
  }

  /**
   * Given an sfdc.co shortened url it returns the actual/full url that this will redirect to.
   *
   * @param httpsUrl The sfdc.co shortened url
   * @returns The actual/full url
   */
  public static async fetchFullUrlFromSfdc(httpsUrl: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      https
        .get(httpsUrl, (response) => {
          let data = '';
          response.on('data', (chunk) => {
            data += chunk;
          });
          response.on('end', () => {
            // sfdc.co urls will lead to an html page where, among other elements, there would be
            // an element with id='full-url' and whose value would be the url to redirect to, eg:
            // <h2 class="home-heading" style="word-wrap:break-word;" id="full-url">
            //      https://developer.salesforce.com/files/sfmobiletools/SalesforceApp-Simulator-248.061-iOS.zip
            // </h2>
            const regex = /<[^>]*id\s*=\s*["']full-url["'][^>]*>(.*?)<\/[^>]*>/i;
            const match = data.match(regex);
            if (match?.[1]) {
              resolve(match[1]);
            } else {
              resolve('');
            }
          });
        })
        .on('error)', (error) => {
          reject(error);
        });
    });
  }

  /**
   * Extracts a ZIP archive to an output directory.
   *
   * @param zipFilePath The path to the ZIP archive
   * @param outputDir An optional output directory - if omitted then defaults to the same directory as the ZIP file
   * @param logger An optional logger to be used for logging
   */
  public static async extractZIPArchive(zipFilePath: string, outputDir?: string, logger?: Logger): Promise<void> {
    let archive = path.resolve(CommonUtils.resolveUserHomePath(zipFilePath));
    let outDir = outputDir ? path.resolve(CommonUtils.resolveUserHomePath(outputDir)) : path.dirname(archive);

    archive = CommonUtils.convertToUnixPath(archive);
    outDir = CommonUtils.convertToUnixPath(outDir);

    const cmd =
      process.platform === 'win32'
        ? `powershell -Command "$ProgressPreference = 'SilentlyContinue'; Expand-Archive -Path \\"${archive}\\" -DestinationPath \\"${outDir}\\" -Force"`
        : `unzip -o -qq ${archive} -d ${outDir}`;

    logger?.debug(`Extracting archive ${zipFilePath}`);
    await CommonUtils.executeCommandAsync(cmd, logger);
  }

  public static async getEntityId(username: string): Promise<string> {
    const identityData = await ConfigUtils.getIdentityData();
    let entityId: string | undefined;
    if (!identityData) {
      return Promise.reject(new Error(messages.getMessage('error.identitydata')));
    } else {
      entityId = identityData.usernameToServerEntityIdMap[username];
      if (!entityId) {
        return Promise.reject(new Error(messages.getMessage('error.identitydata.entityid')));
      }
      return entityId;
    }
  }

  private static async doGetNextAvailablePort(startingPort: number): Promise<number> {
    let port = startingPort;
    let done = false;

    while (!done) {
      const cmd =
        process.platform === 'win32' ? `netstat -an | find "LISTENING" | find ":${port}"` : `lsof -i :${port}`;

      try {
        const result = CommonUtils.executeCommandSync(cmd);
        if (result.trim()) {
          port = port + 2; // that port is in use so try another
        } else {
          done = true;
        }
      } catch (error) {
        // On some platforms (like mac) if the command doesn't produce
        // any results then that is considered an error but in our case
        // that means the port is not in use and is ready for us to use.
        done = true;
      }
    }

    return Promise.resolve(port);
  }
}
