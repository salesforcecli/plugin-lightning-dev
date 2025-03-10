/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
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
