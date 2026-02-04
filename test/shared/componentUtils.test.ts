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

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sinon from 'sinon';
import { expect } from 'chai';
import { ComponentUtils } from '../../src/shared/componentUtils.js';

describe('componentUtils', () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it('converts camel case component name to title case', () => {
    expect(ComponentUtils.componentNameToTitleCase('myButton')).to.equal('My Button');
    expect(ComponentUtils.componentNameToTitleCase('myButtonGroup')).to.equal('My Button Group');
  });

  it('detects lightning type json file paths', () => {
    expect(
      ComponentUtils.isLightningTypeJsonFile(
        '/force-app/main/default/lightningTypes/ExampleType/exampleBundle/renderer.json',
      ),
    ).to.equal(true);
    expect(
      ComponentUtils.isLightningTypeJsonFile(
        '/force-app/main/default/lightningTypes/ExampleType/exampleBundle/editor.json',
      ),
    ).to.equal(true);
    expect(ComponentUtils.isLightningTypeJsonFile('/force-app/main/default/lwc/example/example.js')).to.equal(false);
  });

  it('extracts component name from lightning type json', async () => {
    sandbox.stub(fs.promises, 'readFile').resolves(
      JSON.stringify({
        renderer: {
          componentOverrides: {
            $: {
              definition: 'c/exampleRenderer',
            },
          },
        },
      }),
    );

    const result = await ComponentUtils.getLightningTypeOverrideOptions(
      '/force-app/main/default/lightningTypes/ExampleType/exampleBundle/renderer.json',
    );

    expect(result?.[0].componentName).to.equal('exampleRenderer');
  });

  it('extracts component name from named override entries', async () => {
    sandbox.stub(fs.promises, 'readFile').resolves(
      JSON.stringify({
        renderer: {
          componentOverrides: {
            name: {
              definition: 'c/outputText',
            },
          },
        },
      }),
    );

    const result = await ComponentUtils.getLightningTypeOverrideOptions(
      '/force-app/main/default/lightningTypes/ExampleType/exampleBundle/renderer.json',
    );

    expect(result?.[0].componentName).to.equal('outputText');
  });

  it('returns ordered lightning type override options', async () => {
    sandbox.stub(fs.promises, 'readFile').resolves(
      JSON.stringify({
        renderer: {
          componentOverrides: {
            name: {
              definition: 'c/outputText',
            },
            $: {
              definition: 'c/defaultRenderer',
            },
          },
        },
      }),
    );

    const result = await ComponentUtils.getLightningTypeOverrideOptions(
      '/force-app/main/default/lightningTypes/ExampleType/exampleBundle/renderer.json',
    );

    expect(result?.map((option) => option.id)).to.deep.equal(['renderer', 'renderer:name']);
  });

  it('finds lightning type json paths by name', async () => {
    const tempRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'lightning-types-'));
    const rendererPath = path.join(
      tempRoot,
      'force-app',
      'main',
      'default',
      'lightningTypes',
      'ExampleType',
      'exampleBundle',
      'renderer.json',
    );

    await fs.promises.mkdir(path.dirname(rendererPath), { recursive: true });
    await fs.promises.writeFile(rendererPath, '{}', 'utf8');

    try {
      const result = await ComponentUtils.getLightningTypeJsonPathsByName(tempRoot, 'ExampleType');

      expect(result).to.deep.equal([rendererPath]);
    } finally {
      await fs.promises.rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('extracts component name from collection renderer overrides', async () => {
    sandbox.stub(fs.promises, 'readFile').resolves(
      JSON.stringify({
        collection: {
          renderer: {
            componentOverrides: {
              $: {
                definition: 'c/outputListText',
              },
            },
          },
        },
      }),
    );

    const result = await ComponentUtils.getLightningTypeOverrideOptions(
      '/force-app/main/default/lightningTypes/ExampleType/exampleBundle/renderer.json',
    );

    expect(result?.[0].componentName).to.equal('outputListText');
  });

  it('returns empty list for empty definition in lightning type json', async () => {
    sandbox.stub(fs.promises, 'readFile').resolves(
      JSON.stringify({
        editor: {
          componentOverrides: {
            $: {
              definition: '',
            },
          },
        },
      }),
    );

    const result = await ComponentUtils.getLightningTypeOverrideOptions(
      '/force-app/main/default/lightningTypes/ExampleType/exampleBundle/editor.json',
    );

    expect(result).to.deep.equal([]);
  });

  it('returns undefined for non-lightning type paths', async () => {
    const readStub = sandbox.stub(fs.promises, 'readFile').resolves('');

    const result = await ComponentUtils.getLightningTypeOverrideOptions(
      '/force-app/main/default/lwc/example/example.js',
    );

    expect(result).to.equal(undefined);
    expect(readStub.called).to.equal(false);
  });
});
