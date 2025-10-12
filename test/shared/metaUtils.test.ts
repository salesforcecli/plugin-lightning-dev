/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { AuthInfo, Connection } from '@salesforce/core';
import { TestContext } from '@salesforce/core/testSetup';
import { MetaUtils } from '../../src/shared/metaUtils.js';

describe('MetaUtils', () => {
  const $$ = new TestContext();

  afterEach(() => {
    $$.restore();
  });

  describe('getLightningExperienceSettings', () => {
    it('should return Lightning Experience Settings metadata', async () => {
      const mockMetadata = {
        fullName: 'enableLightningPreviewPref',
        enableLightningPreviewPref: 'true',
      };

      $$.SANDBOX.stub(Connection.prototype, 'metadata').value({
        read: $$.SANDBOX.stub().resolves(mockMetadata),
      });

      const connection = new Connection({ authInfo: new AuthInfo() });
      const result = await MetaUtils.getLightningExperienceSettings(connection);

      expect(result).to.deep.equal(mockMetadata);
    });

    it('should handle array response', async () => {
      const mockMetadata = [
        {
          fullName: 'enableLightningPreviewPref',
          enableLightningPreviewPref: 'true',
        },
      ];

      $$.SANDBOX.stub(Connection.prototype, 'metadata').value({
        read: $$.SANDBOX.stub().resolves(mockMetadata),
      });

      const connection = new Connection({ authInfo: new AuthInfo() });
      const result = await MetaUtils.getLightningExperienceSettings(connection);

      expect(result).to.deep.equal(mockMetadata[0]);
    });

    it('should throw error if metadata is null', async () => {
      $$.SANDBOX.stub(Connection.prototype, 'metadata').value({
        read: $$.SANDBOX.stub().resolves(null),
      });

      const connection = new Connection({ authInfo: new AuthInfo() });

      try {
        await MetaUtils.getLightningExperienceSettings(connection);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect((error as Error).message).to.equal('Unable to retrieve Lightning Experience Settings metadata.');
      }
    });

    it('should throw error if array response is empty', async () => {
      $$.SANDBOX.stub(Connection.prototype, 'metadata').value({
        read: $$.SANDBOX.stub().resolves([]),
      });

      const connection = new Connection({ authInfo: new AuthInfo() });

      try {
        await MetaUtils.getLightningExperienceSettings(connection);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect((error as Error).message).to.equal('Lightning Experience Settings metadata response was empty.');
      }
    });
  });

  describe('isLightningPreviewEnabled', () => {
    it('should return true when Lightning Preview is enabled', async () => {
      const mockMetadata = {
        fullName: 'enableLightningPreviewPref',
        enableLightningPreviewPref: 'true',
      };

      $$.SANDBOX.stub(Connection.prototype, 'metadata').value({
        read: $$.SANDBOX.stub().resolves(mockMetadata),
      });

      const connection = new Connection({ authInfo: new AuthInfo() });
      const result = await MetaUtils.isLightningPreviewEnabled(connection);

      expect(result).to.be.true;
    });

    it('should return false when Lightning Preview is disabled', async () => {
      const mockMetadata = {
        fullName: 'enableLightningPreviewPref',
        enableLightningPreviewPref: 'false',
      };

      $$.SANDBOX.stub(Connection.prototype, 'metadata').value({
        read: $$.SANDBOX.stub().resolves(mockMetadata),
      });

      const connection = new Connection({ authInfo: new AuthInfo() });
      const result = await MetaUtils.isLightningPreviewEnabled(connection);

      expect(result).to.be.false;
    });

    it('should return false when enableLightningPreviewPref is undefined', async () => {
      const mockMetadata = {
        fullName: 'enableLightningPreviewPref',
      };

      $$.SANDBOX.stub(Connection.prototype, 'metadata').value({
        read: $$.SANDBOX.stub().resolves(mockMetadata),
      });

      const connection = new Connection({ authInfo: new AuthInfo() });
      const result = await MetaUtils.isLightningPreviewEnabled(connection);

      expect(result).to.be.false;
    });

    it('should return false on error', async () => {
      $$.SANDBOX.stub(Connection.prototype, 'metadata').value({
        read: $$.SANDBOX.stub().rejects(new Error('Network error')),
      });

      const connection = new Connection({ authInfo: new AuthInfo() });
      const result = await MetaUtils.isLightningPreviewEnabled(connection);

      expect(result).to.be.false;
    });
  });

  describe('setLightningPreviewEnabled', () => {
    it('should enable Lightning Preview successfully', async () => {
      const mockUpdateResult = {
        success: true,
        fullName: 'enableLightningPreviewPref',
      };

      const updateStub = $$.SANDBOX.stub().resolves(mockUpdateResult);
      $$.SANDBOX.stub(Connection.prototype, 'metadata').value({
        update: updateStub,
      });

      const connection = new Connection({ authInfo: new AuthInfo() });
      await MetaUtils.setLightningPreviewEnabled(connection, true);

      expect(
        updateStub.calledWith('LightningExperienceSettings', {
          fullName: 'enableLightningPreviewPref',
          enableLightningPreviewPref: 'true',
        })
      ).to.be.true;
    });

    it('should disable Lightning Preview successfully', async () => {
      const mockUpdateResult = {
        success: true,
        fullName: 'enableLightningPreviewPref',
      };

      const updateStub = $$.SANDBOX.stub().resolves(mockUpdateResult);
      $$.SANDBOX.stub(Connection.prototype, 'metadata').value({
        update: updateStub,
      });

      const connection = new Connection({ authInfo: new AuthInfo() });
      await MetaUtils.setLightningPreviewEnabled(connection, false);

      expect(
        updateStub.calledWith('LightningExperienceSettings', {
          fullName: 'enableLightningPreviewPref',
          enableLightningPreviewPref: 'false',
        })
      ).to.be.true;
    });

    it('should handle array response', async () => {
      const mockUpdateResult = [
        {
          success: true,
          fullName: 'enableLightningPreviewPref',
        },
      ];

      const updateStub = $$.SANDBOX.stub().resolves(mockUpdateResult);
      $$.SANDBOX.stub(Connection.prototype, 'metadata').value({
        update: updateStub,
      });

      const connection = new Connection({ authInfo: new AuthInfo() });
      await MetaUtils.setLightningPreviewEnabled(connection, true);

      expect(updateStub.called).to.be.true;
    });

    it('should throw error when update fails', async () => {
      const mockUpdateResult = {
        success: false,
        fullName: 'enableLightningPreviewPref',
        errors: [{ message: 'Update failed' }],
      };

      $$.SANDBOX.stub(Connection.prototype, 'metadata').value({
        update: $$.SANDBOX.stub().resolves(mockUpdateResult),
      });

      const connection = new Connection({ authInfo: new AuthInfo() });

      try {
        await MetaUtils.setLightningPreviewEnabled(connection, true);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect((error as Error).message).to.equal('Update failed');
      }
    });

    it('should throw generic error when update fails without error message', async () => {
      const mockUpdateResult = {
        success: false,
        fullName: 'enableLightningPreviewPref',
      };

      $$.SANDBOX.stub(Connection.prototype, 'metadata').value({
        update: $$.SANDBOX.stub().resolves(mockUpdateResult),
      });

      const connection = new Connection({ authInfo: new AuthInfo() });

      try {
        await MetaUtils.setLightningPreviewEnabled(connection, true);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect((error as Error).message).to.equal('Failed to update Lightning Preview setting.');
      }
    });
  });

  describe('ensureLightningPreviewEnabled', () => {
    it('should return true if Lightning Preview is already enabled', async () => {
      const mockMetadata = {
        fullName: 'enableLightningPreviewPref',
        enableLightningPreviewPref: 'true',
      };

      $$.SANDBOX.stub(Connection.prototype, 'metadata').value({
        read: $$.SANDBOX.stub().resolves(mockMetadata),
      });

      const connection = new Connection({ authInfo: new AuthInfo() });
      const result = await MetaUtils.ensureLightningPreviewEnabled(connection);

      expect(result).to.be.true;
    });

    it('should enable Lightning Preview and return false if it was disabled', async () => {
      const mockMetadata = {
        fullName: 'enableLightningPreviewPref',
        enableLightningPreviewPref: 'false',
      };

      const mockUpdateResult = {
        success: true,
        fullName: 'enableLightningPreviewPref',
      };

      $$.SANDBOX.stub(Connection.prototype, 'metadata').value({
        read: $$.SANDBOX.stub().resolves(mockMetadata),
        update: $$.SANDBOX.stub().resolves(mockUpdateResult),
      });

      const connection = new Connection({ authInfo: new AuthInfo() });
      const result = await MetaUtils.ensureLightningPreviewEnabled(connection);

      expect(result).to.be.false;
    });
  });
});
