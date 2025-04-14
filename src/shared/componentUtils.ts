/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import path from 'node:path';
import fs from 'node:fs';
import { glob } from 'glob';
import { parseStringPromise } from 'xml2js';
import { SfProject } from '@salesforce/core';

export type LwcMetadata = {
  LightningComponentBundle: {
    description?: string;
    masterLabel?: string;
  };
};

export class ComponentUtils {
  public static componentNameToTitleCase(componentName: string): string {
    if (!componentName) {
      return '';
    }

    return componentName.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase());
  }

  public static async getNamespacePaths(project: SfProject): Promise<string[]> {
    const packageDirs = project.getPackageDirectories();

    return (await Promise.all(packageDirs.map((dir) => glob(`${dir.fullPath}/**/lwc`, { absolute: true })))).flat();
  }

  public static async getAllComponentPaths(namespacePaths: string[]): Promise<string[]> {
    return (
      await Promise.all(namespacePaths.map((namespacePath) => ComponentUtils.getComponentPaths(namespacePath)))
    ).flat();
  }

  public static async getComponentPaths(namespacePath: string): Promise<string[]> {
    const children = await fs.promises.readdir(namespacePath, { withFileTypes: true });

    return children.filter((child) => child.isDirectory()).map((child) => path.join(child.parentPath, child.name));
  }

  public static async getComponentMetadata(dirname: string): Promise<LwcMetadata | undefined> {
    const componentName = path.basename(dirname);
    const metaXmlPath = path.join(dirname, `${componentName}.js-meta.xml`);
    if (!fs.existsSync(metaXmlPath)) {
      return undefined;
    }

    const xmlContent = await fs.promises.readFile(metaXmlPath, 'utf8');
    const parsedData = (await parseStringPromise(xmlContent)) as LwcMetadata;
    if (!this.isLwcMetadata(parsedData)) {
      return undefined;
    }

    if (parsedData.LightningComponentBundle) {
      parsedData.LightningComponentBundle.masterLabel = this.normalizeMetaProperty(
        parsedData.LightningComponentBundle.masterLabel
      );
      parsedData.LightningComponentBundle.description = this.normalizeMetaProperty(
        parsedData.LightningComponentBundle.description
      );
    }

    return parsedData;
  }

  private static isLwcMetadata(obj: unknown): obj is LwcMetadata {
    return (obj && typeof obj === 'object' && 'LightningComponentBundle' in obj) === true;
  }

  private static normalizeMetaProperty(prop: string[] | string | undefined): string | undefined {
    if (!prop || typeof prop === 'string') {
      return prop;
    }

    if (Array.isArray(prop) && prop.length > 0) {
      return prop[0];
    }

    return undefined;
  }
}
