/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import fs from 'node:fs';
import path from 'node:path';
// import zlib from 'node:zlib';
// import { pipeline } from 'node:stream';
// import { promisify } from 'node:util';
// eslint-disable-next-line import/no-extraneous-dependencies
import * as tar from 'tar';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { expDev } from '@lwrjs/core/api';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@salesforce/plugin-lightning-dev', 'lightning.preview.site');

export type LightningPreviewSiteResult = {
  path: string;
};

export default class LightningPreviewSite extends SfCommand<LightningPreviewSiteResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    name: Flags.string({
      summary: messages.getMessage('flags.name.summary'),
      description: messages.getMessage('flags.name.description'),
      char: 'n',
      required: false,
    }),
    debug: Flags.boolean({
      summary: messages.getMessage('flags.debug.summary'),
    }),
    'target-org': Flags.optionalOrg(),
  };

  public async run(): Promise<LightningPreviewSiteResult> {
    const { flags } = await this.parse(LightningPreviewSite);

    // 1. Collect Flags
    const siteName = flags.name ?? 'B2C_CodeCept';

    // TODO don't redownload the app
    if (!fs.existsSync('app')) {
      this.log('getting org connection');

      // 2. Connect to Org
      const connection = flags['target-org'].getConnection();

      // 3. Check if the site exists
      this.log('checking site exists');
      // TODO cleanup query
      const result = await connection.query<{ Id: string; Name: string; LastModifiedDate: string }>(
        "SELECT Id, Name, LastModifiedDate FROM StaticResource WHERE Name LIKE 'MRT%" + siteName + "' LIMIT 1"
      );

      // 4. Download the static resource
      if (result.records[0]) {
        const resourceName = result.records[0].Name;
        this.log(`Found Site: ${resourceName}`);

        this.log('Downloading static resource...');
        const staticresource = await connection.metadata.read('StaticResource', resourceName);
        this.log('Resource downloaded!');
        if (staticresource?.content) {
          // 5a. Save the resource
          // const { contentType } = staticresource;
          const buffer = Buffer.from(staticresource.content, 'base64');
          // // const path = `${resourceName}.${contentType.split('/')[1]}`;
          const resourcePath = `${resourceName}.gz`;
          this.log(`Writing file to path: ${resourcePath}`);
          fs.writeFileSync(resourcePath, buffer);

          // Cleanup old directories
          fs.rmSync('app', { recursive: true, force: true });
          fs.rmSync('bld', { recursive: true, force: true });

          // Extract to specific directory
          // Ensure output directory exists
          // fs.mkdirSync('app', { recursive: true });

          // 5b. Extracting static resource
          await tar.x({
            file: resourcePath,
          });

          fs.renameSync('bld', 'app');
          this.log(`Resource extracted successfully to: ${resourcePath}`);
          // fs.unlinkSync(tempPath); // Clean up the temporary file

          // Setup the stream pipeline for unzipping
          // const pipe = promisify(pipeline);
          // const gunzip = zlib.createGunzip();
          // const inputStream = fs.createReadStream(resourcePath);
          // const output = fs.createWriteStream(path.join('app', 'bld'));
          // await pipe(inputStream, gunzip, output);

          // 5c. Temp - copy a proxy file
          // TODO query for the url if we need to
          // const newResult = await connection.query<{ Name: string; UrlPathPrefix: string }>(
          //   `SELECT Name, UrlPathPrefix FROM Network WHERE Name = '${siteName}'`
          // );

          // TODO should be included with bundle
          const proxyPath = path.join('app', 'config', '_proxy');
          fs.writeFileSync(
            proxyPath,
            '/services https://dsg000007tzqk2ak.test1.my.pc-rnd.site.com' +
              '\n/sfsites https://dsg000007tzqk2ak.test1.my.pc-rnd.site.com' +
              '\n/webruntime https://dsg000007tzqk2ak.test1.my.pc-rnd.site.com'
          );
        } else {
          this.error(`Static Resource for ${siteName} not found.`);
        }
      } else {
        this.log('couldnt find your site');
      }
    }

    // 6. Start the dev server
    this.log('starting up the dev server');
    // TODO add additional args
    // eslint-disable-next-line unicorn/numeric-separators-style
    await expDev({ open: false, port: 3000, timeout: 30000 });
    const name = flags.name ?? 'world';
    this.log(`hello ${name} from /Users/nkruk/git/plugin-lightning-dev/src/commands/lightning/preview/site.ts`);
    return {
      path: '/Users/nkruk/git/plugin-lightning-dev/src/commands/lightning/preview/site.ts',
    };
  }
}
