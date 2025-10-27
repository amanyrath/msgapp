import { getStorage, ref, uploadBytes, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import * as FileSystem from 'expo-file-system';

/**
 * Audio Storage Utilities for Firebase Storage
 * Handles uploading, downloading, and managing audio files
 */

const storage = getStorage();

/**
 * Upload audio file to Firebase Storage
 * @param {string} audioURI - Local file URI
 * @param {string} chatId - Chat ID for organization
 * @param {string} userId - User ID for organization
 * @param {function} onProgress - Progress callback (optional)
 * @returns {Promise<object>} Upload result with download URL
 */
export async function uploadAudioMessage(audioURI, chatId, userId, onProgress = null) {
  try {
    // Generate unique filename
    const timestamp = Date.now();
    const fileName = `audio_${timestamp}.m4a`;
    const audioPath = `chats/${chatId}/audio/${fileName}`;
    
    // Read file as blob
    const response = await fetch(audioURI);
    const blob = await response.blob();
    
    // Create storage reference
    const audioRef = ref(storage, audioPath);
    
    if (onProgress) {
      // Use resumable upload with progress tracking
      const uploadTask = uploadBytesResumable(audioRef, blob);
      
      return new Promise((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            onProgress(progress);
          },
          (error) => {
            console.error('Upload error:', error);
            reject({
              success: false,
              error: error.message
            });
          },
          async () => {
            try {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              resolve({
                success: true,
                downloadURL,
                fileName,
                path: audioPath,
                size: blob.size
              });
            } catch (error) {
              reject({
                success: false,
                error: error.message
              });
            }
          }
        );
      });
    } else {
      // Simple upload without progress
      const snapshot = await uploadBytes(audioRef, blob);
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      return {
        success: true,
        downloadURL,
        fileName,
        path: audioPath,
        size: blob.size
      };
    }
  } catch (error) {
    console.error('Audio upload error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Delete audio file from Firebase Storage
 * @param {string} audioPath - Storage path of the audio file
 * @returns {Promise<object>} Deletion result
 */
export async function deleteAudioMessage(audioPath) {
  try {
    const audioRef = ref(storage, audioPath);
    await deleteObject(audioRef);
    
    return {
      success: true
    };
  } catch (error) {
    console.error('Audio deletion error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get audio file metadata
 * @param {string} audioURI - Local file URI
 * @returns {Promise<object>} File metadata
 */
export async function getAudioMetadata(audioURI) {
  try {
    const fileInfo = await FileSystem.getInfoAsync(audioURI);
    
    if (!fileInfo.exists) {
      throw new Error('Audio file not found');
    }
    
    return {
      success: true,
      size: fileInfo.size,
      uri: fileInfo.uri,
      modificationTime: fileInfo.modificationTime
    };
  } catch (error) {
    console.error('Error getting audio metadata:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Cache audio file locally for offline playback
 * @param {string} downloadURL - Firebase Storage download URL
 * @param {string} fileName - Local filename
 * @returns {Promise<string>} Local file URI
 */
export async function cacheAudioForOffline(downloadURL, fileName) {
  try {
    const localURI = FileSystem.documentDirectory + 'audio_cache/' + fileName;
    
    // Create cache directory if it doesn't exist
    const cacheDir = FileSystem.documentDirectory + 'audio_cache/';
    const dirInfo = await FileSystem.getInfoAsync(cacheDir);
    
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
    }
    
    // Check if file is already cached
    const cachedFileInfo = await FileSystem.getInfoAsync(localURI);
    if (cachedFileInfo.exists) {
      return localURI;
    }
    
    // Download and cache the file
    const downloadResult = await FileSystem.downloadAsync(downloadURL, localURI);
    
    if (downloadResult.status === 200) {
      return downloadResult.uri;
    } else {
      throw new Error('Failed to download audio file');
    }
  } catch (error) {
    console.error('Error caching audio:', error);
    // Return original URL as fallback
    return downloadURL;
  }
}

/**
 * Clear audio cache (for cleanup)
 * @returns {Promise<void>}
 */
export async function clearAudioCache() {
  try {
    const cacheDir = FileSystem.documentDirectory + 'audio_cache/';
    const dirInfo = await FileSystem.getInfoAsync(cacheDir);
    
    if (dirInfo.exists) {
      await FileSystem.deleteAsync(cacheDir, { idempotent: true });
    }
  } catch (error) {
    console.error('Error clearing audio cache:', error);
  }
}

/**
 * Get cached file size for cleanup management
 * @returns {Promise<number>} Total cache size in bytes
 */
export async function getAudioCacheSize() {
  try {
    const cacheDir = FileSystem.documentDirectory + 'audio_cache/';
    const dirInfo = await FileSystem.getInfoAsync(cacheDir);
    
    if (!dirInfo.exists) {
      return 0;
    }
    
    const files = await FileSystem.readDirectoryAsync(cacheDir);
    let totalSize = 0;
    
    for (const file of files) {
      const fileInfo = await FileSystem.getInfoAsync(cacheDir + file);
      if (fileInfo.exists) {
        totalSize += fileInfo.size;
      }
    }
    
    return totalSize;
  } catch (error) {
    console.error('Error calculating cache size:', error);
    return 0;
  }
}

export default {
  uploadAudioMessage,
  deleteAudioMessage,
  getAudioMetadata,
  cacheAudioForOffline,
  clearAudioCache,
  getAudioCacheSize
};

