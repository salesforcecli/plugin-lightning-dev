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

// **********************************************************************************************
// * TODO: When we finalize the implementation for the dev commands and things settle down, *
// *       consider moving most of these into PreviewUtils of lwc-dev-mobile-core instead.      *
// **********************************************************************************************

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Connection, Logger, Messages, Org } from '@salesforce/core';
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
const sharedMessages = Messages.loadMessages('@salesforce/plugin-lightning-dev', 'shared.utils');
const DevPreviewAuraMode = 'DEVPREVIEW';

export type PreviewConnection = {
  connection: Connection;
  ldpServerId: string;
  ldpServerToken: string;
};

export class PreviewUtils {
  public static generateWebSocketUrlForLocalDevServer(
    platform: string,
    ports: { httpPort: number; httpsPort: number },
    logger?: Logger
  ): string {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
    return LwcDevMobileCorePreviewUtils.generateWebSocketUrlForLocalDevServer(platform, ports, logger as any);
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
      return userConfiguredPorts;
    }

    const httpPort = await this.doGetNextAvailablePort(LOCAL_DEV_SERVER_DEFAULT_HTTP_PORT);
    const httpsPort = await this.doGetNextAvailablePort(httpPort + 1);

    return { httpPort, httpsPort };
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
          ? // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
            await new AppleDeviceManager(logger as any).getDevice(deviceId)
          : // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
            await new AndroidDeviceManager(logger as any).getDevice(deviceId);
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
   * Extracts the target org from command line arguments.
   *
   * There are various ways to pass in a target org (as an alias, as a username, etc).
   * We could have LightningPreviewApp parse its --target-org flag which will be resolved
   * to an Org object (see https://github.com/forcedotcom/sfdx-core/blob/main/src/org/org.ts)
   * then write a bunch of code to look at this Org object to try to determine whether
   * it was initialized using Alias, Username, etc. and get a string representation of the
   * org to be forwarded to OrgOpenCommand.
   *
   * Or we could simply look at the raw arguments passed to the LightningPreviewApp command,
   * find the raw value for --target-org flag and forward that raw value to OrgOpenCommand.
   * The OrgOpenCommand will then parse the raw value automatically. If the value is
   * valid then OrgOpenCommand will consume it and continue. And if the value is invalid then
   * OrgOpenCommand simply throws an error which will get bubbled up to LightningPreviewApp.
   *
   * Here we've chosen the second approach.
   *
   * @param args - Array of command line arguments
   * @returns The target org identifier if found, undefined otherwise
   */
  public static getTargetOrgFromArguments(args: string[]): string | undefined {
    const idx = args.findIndex((item) => item.toLowerCase() === '-o' || item.toLowerCase() === '--target-org');
    let targetOrg: string | undefined;
    if (idx >= 0 && idx < args.length - 1) {
      targetOrg = args[idx + 1];
    }

    return targetOrg;
  }

  /**
   * Generates the proper set of arguments to be used for launching desktop browser and navigating to the right location.
   *
   * @param ldpServerUrl The URL for the local dev server
   * @param ldpServerId Record ID for the identity token
   * @param appId An optional app id for a targeted LEX app
   * @param targetOrg An optional org id
   * @param auraMode An optional Aura Mode (defaults to DEVPREVIEW)
   * @returns Array of arguments to be used by Org:Open command for launching desktop browser
   */
  public static generateDesktopPreviewLaunchArguments(
    ldpServerUrl: string,
    ldpServerId: string,
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
      `${appPath}?0.aura.ldpServerUrl=${ldpServerUrl}&0.aura.ldpServerId=${ldpServerId}&0.aura.mode=${auraMode}`,
    ];

    if (targetOrg) {
      launchArguments.push('--target-org', targetOrg);
    }

    return launchArguments;
  }

  /**
   * Generates the proper set of arguments to be used for launching a component preview in the browser.
   *
   * @param ldpServerUrl The URL for the local dev server
   * @param ldpServerId Record ID for the identity token
   * @param componentName The name of the component to preview
   * @param targetOrg An optional org id
   * @returns Array of arguments to be used by Org:Open command for launching the component preview
   */
  public static generateComponentPreviewLaunchArguments(
    ldpServerUrl: string,
    ldpServerId: string,
    componentName?: string,
    targetOrg?: string
  ): string[] {
    let appPath = `lwr/application/e/devpreview/ai/localdev-preview?ldpServerUrl=${ldpServerUrl}&ldpServerId=${ldpServerId}`;
    if (componentName) {
      // TODO: support other namespaces
      appPath += `&specifier=c/${componentName}`;
    }

    const launchArguments = ['--path', appPath];

    if (targetOrg) {
      launchArguments.push('--target-org', targetOrg);
    }

    return launchArguments;
  }

  /**
   * Generates the full URL for a component preview.
   *
   * @param instanceUrl The URL of the Salesforce instance
   * @param ldpServerUrl The URL for the local dev server
   * @param ldpServerId Record ID for the identity token
   * @param componentName The name of the component to preview
   * @param encodePath Whether to encode the path
   * @returns The full URL for the component preview
   */
  public static generateComponentPreviewUrl(
    instanceUrl: string,
    ldpServerUrl: string,
    ldpServerId: string,
    componentName?: string
  ): string {
    let url = `${instanceUrl}/lwr/application/e/devpreview/ai/localdev-preview?ldpServerUrl=${ldpServerUrl}&ldpServerId=${ldpServerId}`;
    if (componentName) {
      // TODO: support other namespaces
      url += `&specifier=c/${componentName}`;
    }

    return url;
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

  public static async initializePreviewConnection(targetOrg: Org): Promise<PreviewConnection> {
    const connection = targetOrg.getConnection(undefined);
    const username = connection.getUsername();
    if (!username) {
      return Promise.reject(new Error(sharedMessages.getMessage('error.username')));
    }

    const localDevEnabled = await OrgUtils.isLocalDevEnabled(connection);
    if (!localDevEnabled) {
      return Promise.reject(new Error(sharedMessages.getMessage('error.localdev.not.enabled')));
    }

    OrgUtils.getVersionChannel(connection);

    const appServerIdentity = await PreviewUtils.getOrCreateAppServerIdentity(connection);
    const ldpServerToken = appServerIdentity.identityToken;
    const ldpServerId = appServerIdentity.usernameToServerEntityIdMap[username];
    if (!ldpServerId) {
      return Promise.reject(new Error(sharedMessages.getMessage('error.identitydata.entityid')));
    }

    return {
      connection,
      ldpServerId,
      ldpServerToken,
    };
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
