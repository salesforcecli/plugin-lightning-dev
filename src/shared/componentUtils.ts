/*
 * Copyright 2025, Salesforce, Inc.
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
