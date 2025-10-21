/**
 * Mock photo data for testing in Expo Go
 */

// Sample placeholder images from Unsplash (these work without CORS issues)
export const MOCK_PHOTOS = [
  {
    url: 'https://picsum.photos/800/600?random=1',
    width: 800,
    height: 600,
    originalWidth: 1200,
    originalHeight: 900,
  },
  {
    url: 'https://picsum.photos/600/800?random=2', 
    width: 600,
    height: 800,
    originalWidth: 900,
    originalHeight: 1200,
  },
  {
    url: 'https://picsum.photos/800/800?random=3',
    width: 800,
    height: 800,
    originalWidth: 1000,
    originalHeight: 1000,
  },
  {
    url: 'https://picsum.photos/900/600?random=4',
    width: 900,
    height: 600,
    originalWidth: 1200,
    originalHeight: 800,
  },
  {
    url: 'https://picsum.photos/700/900?random=5',
    width: 700,
    height: 900,
    originalWidth: 1000,
    originalHeight: 1300,
  },
];

/**
 * Simulate photo selection process
 * @param {string} source - 'camera' or 'library'
 * @returns {Promise<Object>} Mock photo data
 */
export const selectMockPhoto = async (source) => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Randomly select a mock photo
  const randomIndex = Math.floor(Math.random() * MOCK_PHOTOS.length);
  const selectedPhoto = MOCK_PHOTOS[randomIndex];
  
  console.log(`📸 Mock photo selected from ${source}:`, selectedPhoto.url);
  
  return selectedPhoto;
};

/**
 * Simulate photo upload process (just returns the mock URL)
 * @param {string} uri - Mock photo URI
 * @param {string} chatId - Chat ID  
 * @param {string} userId - User ID
 * @returns {Promise<string>} Mock download URL
 */
export const uploadMockPhoto = async (uri, chatId, userId) => {
  // Simulate upload delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  console.log(`☁️ Mock photo uploaded for chat ${chatId} by user ${userId}`);
  
  // Return the same URI as "uploaded" URL
  return uri;
};

/**
 * Complete mock photo workflow
 * @param {string} source - 'camera' or 'library'
 * @param {string} chatId - Chat ID
 * @param {string} userId - User ID  
 * @returns {Promise<Object>} Mock photo data with download URL
 */
export const processMockPhoto = async (source, chatId, userId) => {
  try {
    console.log(`🎭 Processing mock photo from ${source}`);
    
    // 1. "Select" photo
    const photoData = await selectMockPhoto(source);
    
    // 2. "Upload" photo  
    const downloadURL = await uploadMockPhoto(photoData.url, chatId, userId);
    
    return {
      ...photoData,
      url: downloadURL,
    };
  } catch (error) {
    console.error('Error processing mock photo:', error);
    throw new Error('Failed to process mock photo: ' + error.message);
  }
};
