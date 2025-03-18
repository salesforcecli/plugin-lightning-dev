/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Logger, Org } from '@salesforce/core';

/**
 * Fetches all current Experience Sites using the `/connect/communities` API endpoint.
 *
 * @param org - the salesforce org
 * @returns {Promise<Array<Object>>} An array of community site objects.
 *
 * @example
 * Request:
 * GET `{{orgInstance}}/services/data/v{{version}}/connect/communities`
 *
 * Response:
 * {
 * "communities": [
 *   {
 *     "allowChatterAccessWithoutLogin": true,
 *     "allowMembersToFlag": false,
 *     "builderBasedSnaEnabled": true,
 *     "builderUrl": "https://orgfarm-656f3290cc.test1.my.pc-rnd.salesforce.com/sfsites/picasso/core/config/commeditor.jsp?siteId=0DMSG000001lhVa",
 *     "contentSpaceId": "0ZuSG000001n1la0AA",
 *     "description": "D2C Codecept Murazik",
 *     "guestMemberVisibilityEnabled": false,
 *     "id": "0DBSG000001huWE4AY",
 *     "imageOptimizationCDNEnabled": true,
 *     "invitationsEnabled": false,
 *     "knowledgeableEnabled": false,
 *     "loginUrl": "https://orgfarm-656f3290cc.test1.my.pc-rnd.site.com/d2cbernadette/login",
 *     "memberVisibilityEnabled": false,
 *     "name": "D2C Codecept Murazik",
 *     "nicknameDisplayEnabled": true,
 *     "privateMessagesEnabled": false,
 *     "reputationEnabled": false,
 *     "sendWelcomeEmail": true,
 *     "siteAsContainerEnabled": true,
 *     "siteUrl": "https://orgfarm-656f3290cc.test1.my.pc-rnd.site.com/d2cbernadette",
 *     "status": "Live",
 *     "templateName": "D2C Commerce (LWR)",
 *     "url": "/services/data/v64.0/connect/communities/0DBSG000001huWE4AY",
 *     "urlPathPrefix": "d2cbernadettevforcesite"
 *   },
 *   ...
 * ]
 * }
 */

export async function getAllExpSites(org: Org): Promise<string[]> {
  const logger = Logger.childFromRoot('getAllExpSites');

  const conn = org.getConnection();
  const apiVersion = conn.version;
  const url = `/services/data/v${apiVersion}/connect/communities`;
  try {
    const response = await conn.request<{
      communities: Array<{
        id: string;
        name: string;
        description: string;
        status: string;
        urlPathPrefix: string;
        siteUrl: string;
      }>;
    }>(url);

    if (!response?.communities) {
      return [];
    }

    // TODO Don't filter
    const experienceSites: string[] = response.communities
      .filter((site) => site.status === 'Live')
      .map((site) => site.name);

    return experienceSites;
  } catch (error) {
    logger.error(`Error fetching sites using Connect API: ${url}`, error);
  }
  return [];
}
