/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import { replaceSpacesAndSpecialChars, hasSpacesOrSpecialChars } from '../../src/shared/experience/expSite.js';

describe('replaceSpacesAndSpecialChars', () => {
  it('should replace spaces and special characters with underscores', () => {
    const input = 'site#name@with-special%chars with spaces';
    const expectedOutput = 'site_name_with_special_chars_with_spaces';
    const output = replaceSpacesAndSpecialChars(input);
    expect(output).to.equal(expectedOutput);
  });
});

describe('hasSpacesOrSpecialChars', () => {
  it('should return true if the input string has spaces', () => {
    const input = 'Hello World';
    const output = hasSpacesOrSpecialChars(input);
    expect(output).to.be.true;
  });

  it('should return true if the input string has special characters', () => {
    const input = 'Hello, @#';
    const output = hasSpacesOrSpecialChars(input);
    expect(output).to.be.true;
  });

  it('should return false if the input string has neither spaces nor special characters', () => {
    const input = 'HelloWorld';
    const output = hasSpacesOrSpecialChars(input);
    expect(output).to.be.false;
  });
});
