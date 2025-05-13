/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import path from 'node:path';
import url from 'node:url';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages, SfProject, Logger } from '@salesforce/core';
import { cmpDev } from '@lwrjs/api';
import { ComponentUtils } from '../../../shared/componentUtils.js';
import { PromptUtils } from '../../../shared/promptUtils.js';
import { OrgUtils } from '../../../shared/orgUtils.js';
import { PreviewUtils } from '../../../shared/previewUtils.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-lightning-dev', 'lightning.dev.component');
const appMessages = Messages.loadMessages('@salesforce/plugin-lightning-dev', 'lightning.dev.app');
const sharedMessages = Messages.loadMessages('@salesforce/plugin-lightning-dev', 'shared.utils');

export default class LightningDevComponent extends SfCommand<void> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    name: Flags.string({
      summary: messages.getMessage('flags.name.summary'),
      char: 'n',
      requiredOrDefaulted: false,
    }),
    'target-org': Flags.requiredOrg(),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(LightningDevComponent);
    const logger = await Logger.child(this.ctor.name);

    // Org connection and setup
    const targetOrg = flags['target-org'];
    const connection = targetOrg.getConnection(undefined);
    const username = connection.getUsername();
    if (!username) {
      throw new Error(appMessages.getMessage('error.username'));
    }

    const localDevEnabled = await OrgUtils.isLocalDevEnabled(connection);
    if (!localDevEnabled) {
      throw new Error(sharedMessages.getMessage('error.localdev.not.enabled'));
    }

    OrgUtils.ensureMatchingAPIVersion(connection);

    logger.debug('Configuring local web server identity');
    const appServerIdentity = await PreviewUtils.getOrCreateAppServerIdentity(connection);
    const ldpServerToken = appServerIdentity.identityToken;
    const ldpServerId = appServerIdentity.usernameToServerEntityIdMap[username];
    if (!ldpServerId) {
      throw new Error(appMessages.getMessage('error.identitydata.entityid'));
    }

    const project = await SfProject.resolve();

    const namespacePaths = await ComponentUtils.getNamespacePaths(project);
    const componentPaths = await ComponentUtils.getAllComponentPaths(namespacePaths);
    if (!componentPaths) {
      throw new Error(messages.getMessage('error.directory'));
    }

    const components = (
      await Promise.all(
        componentPaths.map(async (componentPath) => {
          let xml;

          try {
            xml = await ComponentUtils.getComponentMetadata(componentPath);
          } catch (err) {
            this.warn(messages.getMessage('error.component-metadata', [componentPath]));
          }

          // components must have meta xml to be previewed
          if (!xml) {
            return undefined;
          }

          const componentName = path.basename(componentPath);
          const label = ComponentUtils.componentNameToTitleCase(componentName);

          return {
            name: componentName,
            label: xml.LightningComponentBundle.masterLabel ?? label,
            description: xml.LightningComponentBundle.description ?? '',
          };
        })
      )
    ).filter((component) => !!component);

    let name = flags.name;
    if (name) {
      // validate that the component exists before launching the server
      const match = components.find((component) => name === component.name || name === component.label);
      if (!match) {
        throw new Error(messages.getMessage('error.component-not-found', [name]));
      }

      name = match.name;
    } else {
      // prompt the user for a name if one was not provided
      name = await PromptUtils.promptUserToSelectComponent(components);
      if (!name) {
        throw new Error(messages.getMessage('error.component'));
      }
    }

    const dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const rootDir = path.resolve(dirname, '../../../..');
    const serverPorts = await PreviewUtils.getNextAvailablePorts();
    logger.debug(
      `Next available ports for component preview are http=${serverPorts.httpPort} , https=${serverPorts.httpsPort}`
    );

    await cmpDev({
      rootDir,
      mode: 'dev',
      port: serverPorts.httpPort,
      name: `c/${name}`,
      namespacePaths,
    });
  }
}
