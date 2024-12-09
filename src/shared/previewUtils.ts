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
import os from 'node:os';
import path from 'node:path';
import { Connection, Logger, Messages } from '@salesforce/core';
import {
  AndroidDeviceManager,
  AppleDeviceManager,
  BaseDevice,
  CommonUtils,
  CryptoUtils,
  LaunchArgument,
  PreviewUtils as LwcDevMobileCorePreviewUtils,
  Platform,
  SSLCertificateData,
} from '@salesforce/lwc-dev-mobile-core';
import { Progress, Spinner } from '@salesforce/sf-plugins-core';
import fetch from 'node-fetch';
import { ConfigUtils, LOCAL_DEV_SERVER_DEFAULT_HTTP_PORT, LocalWebServerIdentityData } from './configUtils.js';
import { OrgUtils } from './orgUtils.js';
import { PromptUtils } from './promptUtils.js';

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
  ): Promise<BaseDevice | undefined> {
    let device: BaseDevice | undefined;

    logger?.debug(`Attempting to get mobile device for platform ${platform}`);

    if (deviceId) {
      logger?.debug(`Attempting to get device ${deviceId}`);

      device =
        platform === Platform.ios
          ? await new AppleDeviceManager(logger).getDevice(deviceId)
          : await new AndroidDeviceManager(logger).getDevice(deviceId);
    } else {
      logger?.debug('Prompting the user to select a device.');

      device = await PromptUtils.promptUserToSelectMobileDevice(platform, logger);
    }

    return Promise.resolve(device);
  }

  /**
   * If an app name is provided then it will query the org to determine the DurableId for the provided app.
   * Otherwise it will get a list of all of the lightning experience apps in the org that are visible/accessible
   * by the user, prompts the user to select one, then returns the DurableId of the selected app.
   *
   * @param connection the connection to the org
   * @param appName optional - either the DeveloperName or Label for an app
   * @param logger optional - logger to be used for logging
   * @returns the DurableId for an app.
   */
  public static async getLightningExperienceAppId(
    connection: Connection,
    appName?: string,
    logger?: Logger
  ): Promise<string> {
    if (appName) {
      logger?.debug(`Determining App Id for ${appName}`);

      // The appName is optional but if the user did provide an appName then it must be
      // a valid one.... meaning that it should resolve to a valid appId.
      const appId = await OrgUtils.getAppDefinitionDurableId(connection, appName);
      if (!appId) {
        return Promise.reject(new Error(messages.getMessage('error.fetching.app-id', [appName])));
      }

      logger?.debug(`App Id is ${appId} for ${appName}`);
      return appId;
    } else {
      logger?.debug('Prompting the user to select an app.');
      const appDefinition = await PromptUtils.promptUserToSelectLightningExperienceApp(connection);
      logger?.debug(`App Id is ${appDefinition.DurableId} for ${appDefinition.Label}`);
      return appDefinition.DurableId;
    }
  }

  /**
   * Generates the proper set of arguments to be used for launching desktop browser and navigating to the right location.
   *
   * @param ldpServerUrl The URL for the local dev server
   * @param ldpServerId Record ID for the identity token
   * @param appId An optional app id for a targeted LEX app
   * @param targetOrg An optional org id
   * @param browser An optional browser
   * @param auraMode An optional Aura Mode (defaults to DEVPREVIEW)
   * @returns Array of arguments to be used by Org:Open command for launching desktop browser
   */
  public static generateDesktopPreviewLaunchArguments(
    ldpServerUrl: string,
    ldpServerId: string,
    appId?: string,
    targetOrg?: string,
    browser?: string,
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
      `${appPath}?0.aura.ldpServerUrl=${ldpServerUrl}&0.aura.ldpServerId=${ldpServerId}&0.aura.mode=${auraMode}`,
    ];

    if (targetOrg) {
      launchArguments.push('--target-org', targetOrg);
    }

    if (browser) {
      launchArguments.push('--browser', browser);
    }

    return launchArguments;
  }

  /**
   * Generates the proper set of arguments to be used for launching a mobile app with custom launch arguments.
   *
   * @param ldpServerUrl The URL for the local dev server
   * @param ldpServerId Record ID for the identity token
   * @param appName An optional app name for a targeted LEX app
   * @param appId An optional app id for a targeted LEX app
   * @param auraMode An optional Aura Mode (defaults to DEVPREVIEW)
   * @returns Array of arguments to be used as custom launch arguments when launching a mobile app.
   */
  public static generateMobileAppPreviewLaunchArguments(
    ldpServerUrl: string,
    ldpServerId: string,
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

    launchArguments.push({ name: 'aura.ldpServerId', value: ldpServerId });

    return launchArguments;
  }

  /**
   * Checks the global cache to see if a self-signed certificate has previously been generated and cached.
   * If so (and if the cached certificate is not expired) it will then return the cached certificate. Otherwise
   * it will generate a self-signed certificate, cache it, and return it.
   *
   * @returns A self-signed certificate.
   */
  public static async generateSelfSignedCert(): Promise<SSLCertificateData> {
    let data = await ConfigUtils.getCertData();
    if (!data || CryptoUtils.isExpired(data)) {
      data = CryptoUtils.generateSelfSignedCert('localhost', 2048, 820);
      await ConfigUtils.writeCertData(data);
    }

    return data;
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
      fullUrl = await CommonUtils.fetchFullUrlFromSfdcShortenedUrl(sfdcUrl);
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

  public static async getOrCreateAppServerIdentity(connection: Connection): Promise<LocalWebServerIdentityData> {
    const username = connection.getUsername()!;

    let identityData = await ConfigUtils.getIdentityData();
    if (!identityData) {
      const token = CryptoUtils.generateIdentityToken();
      const entityId = await OrgUtils.saveAppServerIdentityToken(connection, token);
      identityData = {
        identityToken: token,
        usernameToServerEntityIdMap: {},
      };
      identityData.usernameToServerEntityIdMap[username] = entityId;
      await ConfigUtils.writeIdentityData(identityData);
    } else {
      let entityId = identityData.usernameToServerEntityIdMap[username];
      if (!entityId) {
        entityId = await OrgUtils.saveAppServerIdentityToken(connection, identityData.identityToken);
        identityData.usernameToServerEntityIdMap[username] = entityId;
        await ConfigUtils.writeIdentityData(identityData);
      }
    }
    return identityData;
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
