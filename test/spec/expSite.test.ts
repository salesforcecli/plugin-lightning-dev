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
import { expect } from 'chai';
import { Connection, Org } from '@salesforce/core';
import sinon from 'sinon';
import { ExperienceSite } from '../../src/shared/experience/expSite.js';

describe('getRemoteMetadata', () => {
  it('should return remote metadata when it exists', async () => {
    const org = new Org();
    const siteName = 'site@with#special-chars';
    const experienceSite = new ExperienceSite(org, siteName);

    // Create a mock Connection instance using sinon
    const mockConnection = sinon.createStubInstance(Connection);

    // Configure the mock to return the desired result when calling query
    mockConnection.query.resolves({
      done: true,
      totalSize: 1,
      records: [
        {
          Name: 'MRT_experience_00DSG00000ECBfZ_0DMSG000001CfA6_site_with_special_chars_10-30_12-47',
          LastModifiedDate: '2024-11-12',
        },
      ],
    });

    // Replace the original connection with the mocked connection
    org.getConnection = () => mockConnection;

    const remoteMetadata = await experienceSite.getRemoteMetadata();

    // Check if the called query matches the expected pattern
    const calledQuery = mockConnection.query.args[0][0];
    const expectedPattern =
      /SELECT Name, LastModifiedDate FROM StaticResource WHERE Name LIKE 'MRT_experience_%_site_with_special_chars/;
    expect(calledQuery).to.match(expectedPattern);

    expect(remoteMetadata).to.deep.equal({
      bundleName: 'MRT_experience_00DSG00000ECBfZ_0DMSG000001CfA6_site_with_special_chars_10-30_12-47',
      bundleLastModified: '2024-11-12',
      coreVersion: '254',
    });
  });
});
