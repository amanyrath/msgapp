import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../config/firebase';
import Constants from 'expo-constants';
import { processMockPhoto } from './mockPhotos';

/**
 * Photo utilities for handling image selection, resizing, and upload
 */

/**
 * Request permissions for camera and media library
 */
export const requestPhotoPermissions = async () => {
  try {
    const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
    const libraryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    return {
      camera: cameraPermission.status === 'granted',
      library: libraryPermission.status === 'granted'
    };
  } catch (error) {
    console.error('Error requesting photo permissions:', error);
    return { camera: false, library: false };
  }
};

/**
 * Show photo selection options and return selected image
 * @param {Object} options - Configuration options
 * @returns {Object|null} Selected image result or null if cancelled
 */
export const selectPhoto = async (options = {}) => {
  const { 
    allowsEditing = true,
    aspect = [1, 1],
    quality = 0.8,
    source = 'ask' // 'ask', 'camera', 'library'
  } = options;

  try {
    let result;

    if (source === 'camera') {
      result = await ImagePicker.launchCameraAsync({
        allowsEditing,
        aspect,
        quality,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
      });
    } else if (source === 'library') {
      result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing,
        aspect,
        quality,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
      });
    } else {
      // Ask user to choose between camera and library
      return null; // We'll handle this in the UI component
    }

    if (!result.cancelled && result.assets && result.assets[0]) {
      return result.assets[0];
    }

    return null;
  } catch (error) {
    console.error('Error selecting photo:', error);
    throw new Error('Failed to select photo: ' + error.message);
  }
};

/**
 * Resize image to phone-appropriate dimensions
 * @param {string} uri - Image URI to resize
 * @param {Object} options - Resize options
 * @returns {Object} Resized image info
 */
export const resizeImage = async (uri, options = {}) => {
  const {
    maxWidth = 800,
    maxHeight = 800,
    compress = 0.8,
    format = ImageManipulator.SaveFormat.JPEG
  } = options;

  try {
    // First get image info
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [
        // Resize to fit within max dimensions while maintaining aspect ratio
        { resize: { width: maxWidth, height: maxHeight } }
      ],
      {
        compress,
        format,
        base64: false
      }
    );

    return {
      uri: result.uri,
      width: result.width,
      height: result.height
    };
  } catch (error) {
    console.error('Error resizing image:', error);
    throw new Error('Failed to resize image: ' + error.message);
  }
};

/**
 * Upload image to Firebase Storage
 * @param {string} uri - Local image URI
 * @param {string} chatId - Chat ID for organizing uploads
 * @param {string} userId - User ID for organizing uploads
 * @returns {Promise<string>} Download URL of uploaded image
 */
export const uploadPhoto = async (uri, chatId, userId) => {
  try {
    // Generate unique filename
    const timestamp = Date.now();
    const filename = `photos/${chatId}/${userId}_${timestamp}.jpg`;
    
    console.log('🔍 Upload Debug Info:', {
      uri,
      chatId,
      userId,
      filename,
      storageInstance: !!storage,
      timestamp
    });
    
    // Create storage reference
    const storageRef = ref(storage, filename);
    console.log('📁 Storage reference created:', storageRef.toString());
    
    // Convert URI to blob
    console.log('📥 Fetching image from URI...');
    const response = await fetch(uri);
    const blob = await response.blob();
    console.log('📦 Blob created:', {
      size: blob.size,
      type: blob.type
    });
    
    // Upload to Firebase Storage
    console.log('☁️ Uploading to Firebase Storage:', filename);
    const uploadResult = await uploadBytes(storageRef, blob);
    console.log('✅ Photo uploaded successfully:', uploadResult.metadata.name);
    
    // Get download URL
    console.log('🔗 Getting download URL...');
    const downloadURL = await getDownloadURL(storageRef);
    console.log('🎉 Photo download URL:', downloadURL);
    
    return downloadURL;
  } catch (error) {
    console.error('❌ Error uploading photo:', error);
    console.error('❌ Error details:', {
      code: error.code,
      message: error.message,
      name: error.name
    });
    throw new Error('Failed to upload photo: ' + error.message);
  }
};

/**
 * Check if running in Expo Go vs development/production build
 * @returns {boolean} True if running in Expo Go
 */
const isExpoGo = () => {
  // Constants.appOwnership is null in Expo Go, 'expo' in dev builds, 'standalone' in production
  return Constants.appOwnership === null;
};

/**
 * Check if real camera/photo functionality is available
 * @returns {boolean} True if real photo functionality should work
 */
const hasRealPhotoCapability = () => {
  // Development builds and standalone builds support real camera
  return Constants.appOwnership === 'expo' || Constants.appOwnership === 'standalone';
};

/**
 * Complete photo workflow: select, resize, and upload
 * @param {string} source - 'camera' or 'library'
 * @param {string} chatId - Chat ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Photo info with download URL
 */
export const processPhoto = async (source, chatId, userId) => {
  try {
    // Use mock photos in Expo Go, real photos in dev/standalone builds
    if (isExpoGo()) {
      console.log('🎭 Using mock photos (running in Expo Go)');
      return await processMockPhoto(source, chatId, userId);
    }

    if (hasRealPhotoCapability()) {
      console.log('📸 Using real camera/gallery (development/production build)');
    } else {
      console.warn('⚠️ Photo capability detection unclear, attempting real photos');
    }
    
    // 1. Request permissions
    const permissions = await requestPhotoPermissions();
    
    if (source === 'camera' && !permissions.camera) {
      throw new Error('Camera permission not granted');
    }
    
    if (source === 'library' && !permissions.library) {
      throw new Error('Media library permission not granted');
    }
    
    // 2. Select photo
    const selectedPhoto = await selectPhoto({ source });
    
    if (!selectedPhoto) {
      return null; // User cancelled
    }
    
    // 3. Resize photo for mobile
    const resizedPhoto = await resizeImage(selectedPhoto.uri, {
      maxWidth: 800,
      maxHeight: 800,
      compress: 0.7
    });
    
    // 4. Upload to Firebase Storage
    const downloadURL = await uploadPhoto(resizedPhoto.uri, chatId, userId);
    
    return {
      url: downloadURL,
      width: resizedPhoto.width,
      height: resizedPhoto.height,
      originalWidth: selectedPhoto.width,
      originalHeight: selectedPhoto.height
    };
  } catch (error) {
    console.error('Error processing photo:', error);
    throw error;
  }
};

/**
 * Get optimized image dimensions for display in chat
 * @param {number} originalWidth - Original image width
 * @param {number} originalHeight - Original image height  
 * @param {number} maxWidth - Maximum display width
 * @returns {Object} Display dimensions
 */
export const getDisplayDimensions = (originalWidth, originalHeight, maxWidth = 200) => {
  if (!originalWidth || !originalHeight) {
    return { width: maxWidth, height: maxWidth };
  }
  
  const aspectRatio = originalWidth / originalHeight;
  
  if (originalWidth > originalHeight) {
    // Landscape
    return {
      width: Math.min(maxWidth, originalWidth),
      height: Math.min(maxWidth, originalWidth) / aspectRatio
    };
  } else {
    // Portrait or square
    const height = Math.min(maxWidth, originalHeight);
    return {
      width: height * aspectRatio,
      height
    };
  }
};
