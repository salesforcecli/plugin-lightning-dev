/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { TestSession } from '@salesforce/cli-plugins-testkit';
// import { expect } from 'chai';

describe('lightning preview site NUTs', () => {
  let session: TestSession;

  before(async () => {
    session = await TestSession.create({ devhubAuthStrategy: 'NONE' });
  });

  after(async () => {
    await session?.clean();
  });

  // TODO
  it('should display provided name', () => {
    // const name = 'World';
    // const command = `lightning preview site --name ${name}`;
    // const output = execCmd(command, { ensureExitCode: 0 }).shellOutput.stdout;
    // expect(output).to.contain(name);
  });
});
