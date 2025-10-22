/**
 * Mock photo data for testing in Expo Go
 */

// Sample placeholder images from Picsum (reliable placeholder service)
// Using fixed seed for consistent images in demo
export const MOCK_PHOTOS = [
  {
    url: 'https://picsum.photos/seed/msgai1/800/600',
    width: 800,
    height: 600,
    originalWidth: 1200,
    originalHeight: 900,
    description: 'Landscape photo'
  },
  {
    url: 'https://picsum.photos/seed/msgai2/600/800', 
    width: 600,
    height: 800,
    originalWidth: 900,
    originalHeight: 1200,
    description: 'Portrait photo'
  },
  {
    url: 'https://picsum.photos/seed/msgai3/800/800',
    width: 800,
    height: 800,
    originalWidth: 1000,
    originalHeight: 1000,
    description: 'Square photo'
  },
  {
    url: 'https://picsum.photos/seed/msgai4/900/600',
    width: 900,
    height: 600,
    originalWidth: 1200,
    originalHeight: 800,
    description: 'Wide landscape'
  },
  {
    url: 'https://picsum.photos/seed/msgai5/700/900',
    width: 700,
    height: 900,
    originalWidth: 1000,
    originalHeight: 1300,
    description: 'Tall portrait'
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
    console.log(`🎭 Processing mock photo from ${source} (Expo Go mode)`);
    
    // 1. "Select" photo (with simulated delay to match real camera)
    const photoData = await selectMockPhoto(source);
    
    // 2. "Upload" photo (simulate Firebase Storage upload)
    const downloadURL = await uploadMockPhoto(photoData.url, chatId, userId);
    
    const result = {
      ...photoData,
      url: downloadURL,
      isMock: true, // Flag to indicate this is a mock photo
    };
    
    console.log('✅ Mock photo processed successfully:', result.description);
    return result;
  } catch (error) {
    console.error('❌ Error processing mock photo:', error);
    throw new Error('Failed to process mock photo: ' + error.message);
  }
};
