/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { ComponentUtils } from '../../src/shared/componentUtils.js';

describe('componentUtils', () => {
  it('converts camel case component name to title case', () => {
    expect(ComponentUtils.componentNameToTitleCase('myButton')).to.equal('My Button');
    expect(ComponentUtils.componentNameToTitleCase('myButtonGroup')).to.equal('My Button Group');
  });
});
