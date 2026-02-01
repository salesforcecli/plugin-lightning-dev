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

    const result = await ComponentUtils.getComponentNameFromLightningTypeJson(
      '/force-app/main/default/lightningTypes/ExampleType/exampleBundle/renderer.json',
    );

    expect(result).to.equal('exampleRenderer');
  });

  it('returns null for empty definition in lightning type json', async () => {
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

    const result = await ComponentUtils.getComponentNameFromLightningTypeJson(
      '/force-app/main/default/lightningTypes/ExampleType/exampleBundle/editor.json',
    );

    expect(result).to.equal(null);
  });

  it('returns undefined for non-lightning type paths', async () => {
    const readStub = sandbox.stub(fs.promises, 'readFile').resolves('');

    const result = await ComponentUtils.getComponentNameFromLightningTypeJson(
      '/force-app/main/default/lwc/example/example.js',
    );

    expect(result).to.equal(undefined);
    expect(readStub.called).to.equal(false);
  });
});
