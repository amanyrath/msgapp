/**
 * Photo utilities tests
 */

import { processPhoto, getDisplayDimensions } from '../../utils/photos';
import { processMockPhoto } from '../../utils/mockPhotos';

// Mock expo-constants to control Expo Go detection
const mockConstants = {
  appOwnership: null, // Expo Go
};

jest.mock('expo-constants', () => mockConstants);

describe('Photo utilities', () => {
  describe('processPhoto', () => {
    it('should use mock photos in Expo Go', async () => {
      mockConstants.appOwnership = null; // Expo Go
      
      const result = await processPhoto('camera', 'chat123', 'user456');
      
      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('width');
      expect(result).toHaveProperty('height');
      expect(result).toHaveProperty('isMock', true);
    });

    it('should handle camera source', async () => {
      const result = await processPhoto('camera', 'chat123', 'user456');
      expect(result).toBeTruthy();
    });

    it('should handle library source', async () => {
      const result = await processPhoto('library', 'chat123', 'user456');
      expect(result).toBeTruthy();
    });
  });

  describe('getDisplayDimensions', () => {
    it('should calculate landscape dimensions', () => {
      const result = getDisplayDimensions(800, 600, 200);
      expect(result.width).toBe(200);
      expect(result.height).toBe(150);
    });

    it('should calculate portrait dimensions', () => {
      const result = getDisplayDimensions(600, 800, 200);
      expect(result.width).toBe(150);
      expect(result.height).toBe(200);
    });

    it('should handle square images', () => {
      const result = getDisplayDimensions(500, 500, 200);
      expect(result.width).toBe(200);
      expect(result.height).toBe(200);
    });

    it('should handle missing dimensions', () => {
      const result = getDisplayDimensions(null, null, 200);
      expect(result.width).toBe(200);
      expect(result.height).toBe(200);
    });
  });
});
