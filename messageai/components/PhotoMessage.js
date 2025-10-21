import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  StatusBar,
  Dimensions
} from 'react-native';
import { getDisplayDimensions } from '../utils/photos';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

/**
 * PhotoMessage component for displaying photo messages in chat
 */
export default function PhotoMessage({ photo, isOwnMessage, maxWidth = 200 }) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [showFullscreen, setShowFullscreen] = useState(false);

  // Calculate display dimensions
  const displayDimensions = getDisplayDimensions(
    photo?.width,
    photo?.height,
    maxWidth
  );

  const handleImageLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleImageError = (error) => {
    console.error('Photo load error:', error);
    setIsLoading(false);
    setHasError(true);
  };

  const handleImagePress = () => {
    if (!hasError) {
      setShowFullscreen(true);
    }
  };

  const closeFullscreen = () => {
    setShowFullscreen(false);
  };

  if (!photo?.url) {
    return (
      <View style={[styles.errorContainer, { width: displayDimensions.width }]}>
        <Text style={styles.errorText}>📷 Photo unavailable</Text>
      </View>
    );
  }

  return (
    <>
      <TouchableOpacity
        onPress={handleImagePress}
        style={[
          styles.photoContainer,
          {
            width: displayDimensions.width,
            height: displayDimensions.height,
          },
          isOwnMessage ? styles.ownMessage : styles.otherMessage,
        ]}
        activeOpacity={0.8}
      >
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="small" color="#007AFF" />
          </View>
        )}
        
        {hasError ? (
          <View style={styles.errorOverlay}>
            <Text style={styles.errorText}>📷</Text>
            <Text style={styles.errorSubtext}>Failed to load</Text>
          </View>
        ) : (
          <Image
            source={{ uri: photo.url }}
            style={[
              styles.photo,
              {
                width: displayDimensions.width,
                height: displayDimensions.height,
              }
            ]}
            onLoad={handleImageLoad}
            onError={handleImageError}
            resizeMode="cover"
          />
        )}
      </TouchableOpacity>

      {/* Fullscreen Modal */}
      <Modal
        visible={showFullscreen}
        transparent={true}
        animationType="fade"
        onRequestClose={closeFullscreen}
      >
        <StatusBar hidden />
        <View style={styles.fullscreenContainer}>
          <TouchableOpacity
            style={styles.fullscreenBackdrop}
            onPress={closeFullscreen}
            activeOpacity={1}
          >
            <Image
              source={{ uri: photo.url }}
              style={styles.fullscreenPhoto}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  photoContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    marginVertical: 2,
  },
  ownMessage: {
    alignSelf: 'flex-end',
  },
  otherMessage: {
    alignSelf: 'flex-start',
  },
  photo: {
    borderRadius: 12,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  errorContainer: {
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 60,
  },
  errorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  errorSubtext: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 4,
  },
  fullscreenContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenBackdrop: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenPhoto: {
    width: screenWidth,
    height: screenHeight,
  },
});
