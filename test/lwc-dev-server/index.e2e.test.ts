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

// **
// * Commenting out this test file until lwc-dev-server's `stopServer()`
// * can be fixed to not process.exit(0), as it negatively impacts our
// * test runs.
// **
// import path from 'node:path';
// import { fileURLToPath } from 'node:url';
// import { expect } from 'chai';
// import sinon from 'sinon';
// import { Logger } from '@salesforce/core';
// import { TestContext } from '@salesforce/core/testSetup';
// import { LWCServer, Workspace } from '@lwc/lwc-dev-server';
// import * as devServer from '../../src/lwc-dev-server/index.js';
// import { ConfigUtils } from '../../src/shared/configUtils.js';

// // eslint-disable-next-line no-underscore-dangle
// const __dirname = path.dirname(fileURLToPath(import.meta.url));
// const logger = {
//   debug: () => {},
//   warn: () => {},
//   trace: () => {},
//   getLevel: () => 10,
// } as Logger;

// describe('lwc-dev-server e2e', () => {
//   const $$ = new TestContext();
//   let processExitSpy: sinon.SinonSpy;

//   beforeEach(() => {
//     processExitSpy = $$.SANDBOX.stub(process, 'exit');
//     $$.SANDBOX.stub(ConfigUtils, 'getOrCreateIdentityToken').resolves('testIdentityToken');
//     $$.SANDBOX.stub(ConfigUtils, 'getLocalDevServerPort').resolves(1234);
//     $$.SANDBOX.stub(ConfigUtils, 'getLocalDevServerWorkspace').resolves(Workspace.SfCli);
//     $$.SANDBOX.stub(ConfigUtils, 'getCertData').resolves(undefined);
//   });

//   afterEach(() => {
//     $$.restore();
//     $$.SANDBOX.resetHistory();
//   });

//  it('e2e', async () => {
//    const fakeIdentityToken = 'PFT1vw8v65aXd2b9HFvZ3Zu4OcKZwjI60bq7BEjj5k4=';
//    const server = await devServer.startLWCServer(logger, path.resolve(__dirname, './__mocks__'), fakeIdentityToken);

//     expect(server).to.be.an.instanceOf(LWCServer);
//     server.stopServer();
//     expect(processExitSpy.calledWith(0)).to.be.true;
//   });
// });
