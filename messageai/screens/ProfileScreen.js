import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActionSheetIOS,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useLocalization } from '../context/LocalizationContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { createUserProfile } from '../utils/firestore';
import { setUserOnline } from '../utils/presence';
import subscriptionManager from '../utils/subscriptionManager';
import LanguageInitializationScreen from './LanguageInitializationScreen';
import { translateUIText } from '../utils/localization';

export default function ProfileScreen({ navigation }) {
  const { user, signOut } = useAuth();
  const { userLanguagePreference, setUserLanguagePreference, t } = useLocalization();
  const [nickname, setNickname] = useState('');
  const [icon, setIcon] = useState('');
  const [languagePreference, setLanguagePreference] = useState('English');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingLanguage, setSavingLanguage] = useState(false);
  const [showLanguageLoading, setShowLanguageLoading] = useState(false);

  // Available languages
  const availableLanguages = [
    'English',
    'Spanish',
    'French', 
    'German',
    'Italian',
    'Portuguese',
    'Japanese',
    'Chinese',
    'Korean',
    'Arabic',
    'Russian',
    'Dutch',
    'Swedish',
    'Norwegian',
    'Finnish'
  ];

  useEffect(() => {
    loadProfile();
  }, [loadProfile]); // Use memoized loadProfile function

  // Sync local language preference with context - improved synchronization
  useEffect(() => {
    if (userLanguagePreference && userLanguagePreference !== languagePreference) {
      console.log('🔄 Syncing ProfileScreen language with context:', userLanguagePreference);
      setLanguagePreference(userLanguagePreference);
    }
  }, [userLanguagePreference, languagePreference]);

  const loadProfile = useCallback(async () => {
    if (!user?.uid) return;

    try {
      setLoading(true);
      
      // OPTIMIZED: Try to get from cached user profiles first (much faster)
      const cachedProfiles = subscriptionManager.getCachedData('user-profiles');
      let userData = null;
      
      if (cachedProfiles) {
        const userProfile = cachedProfiles.find(profile => profile.id === user.uid);
        if (userProfile) {
          userData = userProfile;
          console.log('🚀 Profile loaded from cache');
        }
      }
      
      // Fallback to Firestore if not in cache
      if (!userData) {
        console.log('📦 Profile not in cache, loading from Firestore');
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          userData = userSnap.data();
        }
      }

      if (userData) {
        setNickname(userData.nickname || userData.displayName || user.email?.split('@')[0] || '');
        setIcon(userData.icon || '👤');
        
        // Priority: Use context language preference if available, otherwise use stored data
        const contextLanguage = userLanguagePreference;
        const storedLanguage = userData.languagePreference || 'English';
        const preferredLanguage = contextLanguage || storedLanguage;
        
        console.log('📱 Language preference loading - Context:', contextLanguage, 'Stored:', storedLanguage, 'Using:', preferredLanguage);
        setLanguagePreference(preferredLanguage);
      } else {
        // Set defaults for users without profiles
        setNickname(user.email?.split('@')[0] || '');
        setIcon('👤');
        setLanguagePreference(userLanguagePreference || 'English');
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert(t('error'), t('failedToLoadProfile', { error: error.message }));
    } finally {
      setLoading(false);
    }
  }, [user?.uid, user?.email, userLanguagePreference, t]);

  const getRandomEmoji = () => {
    const emojis = [
      '😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂',
      '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋',
      '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳',
      '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖',
      '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯',
      '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔',
      '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦',
      '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴',
      '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿',
      '👹', '👺', '🤡', '💩', '👻', '💀', '☠️', '👽', '👾', '🤖',
      '🎃', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾',
      '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯',
      '🦁', '🐮', '🐷', '🐸', '🐵', '🙈', '🙉', '🙊', '🐔', '🐧',
      '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗',
      '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦟', '🦗',
      '🕷', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐',
      '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊',
      '🐅', '🐆', '🦓', '🦍', '🦧', '🐘', '🦛', '🦏', '🐪', '🐫',
      '🦒', '🦘', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🦙',
      '🐐', '🦌', '🐕', '🐩', '🦮', '🐈', '🐓', '🦃', '🦚', '🦜',
      '🦢', '🦩', '🕊', '🐇', '🦝', '🦨', '🦡', '🦦', '🦥', '🐁',
      '🐀', '🐿', '🦔', '🌵', '🎄', '🌲', '🌳', '🌴', '🌱', '🌿',
      '☘️', '🍀', '🎍', '🎋', '🍃', '🍂', '🍁', '🍄', '🌾', '💐',
      '🌷', '🌹', '🥀', '🌺', '🌸', '🌼', '🌻', '🌞', '🌝', '🌛',
      '🌜', '🌚', '🌕', '🌖', '🌗', '🌘', '🌑', '🌒', '🌓', '🌔',
      '⭐️', '🌟', '✨', '⚡️', '☄️', '💥', '🔥', '🌈', '☀️', '🌤',
      '⛅️', '🌥', '☁️', '🌦', '🌧', '⛈', '🌩', '🌨', '❄️', '☃️',
      '⛄️', '🌬', '💨', '💧', '💦', '☔️', '🌊', '🌫', '🍏', '🍎',
      '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈', '🍒', '🍑',
      '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒',
      '🌶', '🌽', '🥕', '🧄', '🧅', '🥔', '🍠', '🥐', '🥯', '🍞',
      '🥖', '🥨', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩',
      '🍗', '🍖', '🌭', '🍔', '🍟', '🍕', '🥪', '🥙', '🧆', '🌮',
      '🌯', '🥗', '🥘', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱',
      '🥟', '🦪', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢',
      '🍡', '🍧', '🍨', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭',
      '🍬', '🍫', '🍿', '🍩', '🍪', '🌰', '🥜', '🍯', '🥛', '🍼',
      '☕️', '🍵', '🧃', '🥤', '🍶', '🍺', '🍻', '🥂', '🍷', '🥃',
      '🍸', '🍹', '🧉', '🍾', '🧊', '🥄', '🍴', '🍽', '🥣', '🥡',
      '⚽️', '🏀', '🏈', '⚾️', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱',
      '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🥅', '⛳️', '🪁',
      '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛷', '⛸', '🥌',
      '🎿', '⛷', '🏂', '🪂', '🏋️', '🤼', '🤸', '🤺', '⛹️', '🤾',
      '🏌️', '🏇', '🧘', '🏊', '🤽', '🚣', '🧗', '🚵', '🚴', '🏆',
      '🥇', '🥈', '🥉', '🏅', '🎖', '🎗', '🏵', '🎫', '🎟', '🎪',
      '🎭', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🎷', '🎺',
      '🎸', '🪕', '🎻', '🎲', '♟', '🎯', '🎳', '🎮', '🎰', '🧩',
      '🚗', '🚕', '🚙', '🚌', '🚎', '🏎', '🚓', '🚑', '🚒', '🚐',
      '🚚', '🚛', '🚜', '🦯', '🦽', '🦼', '🛴', '🚲', '🛵', '🏍',
      '🛺', '🚨', '🚔', '🚍', '🚘', '🚖', '🚡', '🚠', '🚟', '🚃',
      '🚋', '🚞', '🚝', '🚄', '🚅', '🚈', '🚂', '🚆', '🚇', '🚊',
      '🚉', '✈️', '🛫', '🛬', '🛩', '💺', '🛰', '🚀', '🛸', '🚁',
      '🛶', '⛵️', '🚤', '🛥', '🛳', '⛴', '🚢', '⚓️', '⛽️', '🚧',
      '🚦', '🚥', '🚏', '🗺', '🗿', '🗽', '🗼', '🏰', '🏯', '🏟',
      '🎡', '🎢', '🎠', '⛲️', '⛱', '🏖', '🏝', '🏜', '🌋', '⛰',
      '🏔', '🗻', '🏕', '⛺️', '🏠', '🏡', '🏘', '🏚', '🏗', '🏭',
      '🏢', '🏬', '🏣', '🏤', '🏥', '🏦', '🏨', '🏪', '🏫', '🏩',
      '💒', '🏛', '⛪️', '🕌', '🕍', '🛕', '🕋', '⛩', '🛤', '🛣',
      '🗾', '🎑', '🏞', '🌅', '🌄', '🌠', '🎇', '🎆', '🌇', '🌆',
      '🏙', '🌃', '🌌', '🌉', '🌁', '⌚️', '📱', '📲', '💻', '⌨️',
      '🖥', '🖨', '🖱', '🖲', '🕹', '🗜', '💽', '💾', '💿', '📀',
      '📼', '📷', '📸', '📹', '🎥', '📽', '🎞', '📞', '☎️', '📟',
      '📠', '📺', '📻', '🎙', '🎚', '🎛', '🧭', '⏱', '⏲', '⏰',
      '🕰', '⌛️', '⏳', '📡', '🔋', '🔌', '💡', '🔦', '🕯', '🪔',
      '🧯', '🛢', '💸', '💵', '💴', '💶', '💷', '💰', '💳', '💎',
      '⚖️', '🧰', '🔧', '🔨', '⚒', '🛠', '⛏', '🔩', '⚙️', '🧱',
      '⛓', '🧲', '🔫', '💣', '🧨', '🪓', '🔪', '🗡', '⚔️', '🛡',
      '🚬', '⚰️', '⚱️', '🏺', '🔮', '📿', '🧿', '💈', '⚗️', '🔭',
      '🔬', '🕳', '🩹', '🩺', '💊', '💉', '🩸', '🧬', '🦠', '🧫',
      '🧪', '🌡', '🧹', '🧺', '🧻', '🚽', '🚰', '🚿', '🛁', '🛀',
      '🧼', '🪒', '🧽', '🧴', '🛎', '🔑', '🗝', '🚪', '🪑', '🛋',
      '🛏', '🛌', '🧸', '🖼', '🛍', '🛒', '🎁', '🎈', '🎏', '🎀',
      '🎊', '🎉', '🎎', '🏮', '🎐', '🧧', '✉️', '📩', '📨', '📧',
      '💌', '📥', '📤', '📦', '🏷', '📪', '📫', '📬', '📭', '📮',
      '📯', '📜', '📃', '📄', '📑', '🧾', '📊', '📈', '📉', '🗒',
      '🗓', '📆', '📅', '🗑', '📇', '🗃', '🗳', '🗄', '📋', '📁',
      '📂', '🗂', '🗞', '📰', '📓', '📔', '📒', '📕', '📗', '📘',
      '📙', '📚', '📖', '🔖', '🧷', '🔗', '📎', '🖇', '📐', '📏',
      '🧮', '📌', '📍', '✂️', '🖊', '🖋', '✒️', '🖌', '🖍', '📝',
      '✏️', '🔍', '🔎', '🔏', '🔐', '🔒', '🔓', '❤️', '🧡', '💛',
      '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞',
      '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉',
      '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈️', '♉️',
      '♊️', '♋️', '♌️', '♍️', '♎️', '♏️', '♐️', '♑️', '♒️', '♓️',
      '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳', '🈶', '🈚️', '🈸',
      '🈺', '🈷️', '✴️', '🆚', '💮', '🉐', '㊙️', '㊗️', '🈴', '🈵',
      '🈹', '🈲', '🅰️', '🅱️', '🆎', '🆑', '🅾️', '🆘', '❌', '⭕️',
      '🛑', '⛔️', '📛', '🚫', '💯', '💢', '♨️', '🚷', '🚯', '🚳',
      '🚱', '🔞', '📵', '🚭', '❗️', '❕', '❓', '❔', '‼️', '⁉️',
      '🔅', '🔆', '〽️', '⚠️', '🚸', '🔱', '⚜️', '🔰', '♻️', '✅',
      '🈯️', '💹', '❇️', '✳️', '❎', '🌐', '💠', '🌀', '💤', '🏧',
      '🚾', '♿️', '🅿️', '🈳', '🈂️', '🛂', '🛃', '🛄', '🛅', '🚹',
      '🚺', '🚼', '🚻', '🚮', '🎦', '📶', '🈁', '🔣', '🔤', '🔡',
      '🔠', '🆖', '🆗', '🆙', '🆒', '🆕', '🆓', '0️⃣', '1️⃣', '2️⃣',
      '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '🔢', '#️⃣',
      '*️⃣', '⏏️', '▶️', '⏸', '⏯', '⏹', '⏺', '⏭', '⏮', '⏩',
      '⏪', '⏫', '⏬', '◀️', '🔼', '🔽', '➡️', '⬅️', '⬆️', '⬇️',
      '↗️', '↘️', '↙️', '↖️', '↕️', '↔️', '↪️', '↩️', '⤴️', '⤵️',
      '🔀', '🔁', '🔂', '🔄', '🔃', '🎵', '🎶', '➕', '➖', '➗',
      '✖️', '♾', '💲', '💱', '™️', '©️', '®️', '👁‍🗨', '🔚', '🔙',
      '🔛', '🔝', '🔜', '〰️', '➰', '➿', '✔️', '☑️', '🔘', '🔴',
      '🟠', '🟡', '🟢', '🔵', '🟣', '⚫️', '⚪️', '🟤', '🔺', '🔻',
      '🔸', '🔹', '🔶', '🔷', '🔳', '🔲', '▪️', '▫️', '◾️', '◽️',
      '◼️', '◻️', '🟥', '🟧', '🟨', '🟩', '🟦', '🟪', '⬛️', '⬜️',
      '🟫', '🔈', '🔇', '🔉', '🔊', '🔔', '🔕', '📣', '📢', '💬',
      '💭', '🗯', '♠️', '♣️', '♥️', '♦️', '🃏', '🎴', '🀄️', '🕐',
      '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚',
      '🕛', '🕜', '🕝', '🕞', '🕟', '🕠', '🕡', '🕢', '🕣', '🕤',
      '🕥', '🕦', '🕧'
    ];
    return emojis[Math.floor(Math.random() * emojis.length)];
  };

  const handleRandomEmoji = () => {
    const randomEmoji = getRandomEmoji();
    setIcon(randomEmoji);
  };

  const handleLanguageSelection = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [t('cancel'), ...availableLanguages],
          cancelButtonIndex: 0,
          title: t('selectLanguage')
        },
        (buttonIndex) => {
          if (buttonIndex > 0) {
            const selectedLanguage = availableLanguages[buttonIndex - 1];
            handleLanguageChange(selectedLanguage);
          }
        }
      );
    } else {
      // For Android, show alert with options
      const languageOptions = availableLanguages.map(lang => ({
        text: lang,
        onPress: () => handleLanguageChange(lang)
      }));
      
      Alert.alert(
        t('selectLanguage'),
        t('choosePreferredLanguage'),
        [
          { text: t('cancel'), style: 'cancel' },
          ...languageOptions
        ]
      );
    }
  };

  const handleLanguageChange = async (newLanguage) => {
    if (!user?.uid) return;
    
    try {
      setSavingLanguage(true);
      setShowLanguageLoading(true); // Show loading screen
      console.log('Updating language preference:', newLanguage);
      
      // Update via localization context
      const success = await setUserLanguagePreference(user.uid, newLanguage);
      
      if (success) {
        setLanguagePreference(newLanguage);
        
        // Wait longer for translations to fully load
        setTimeout(async () => {
          setShowLanguageLoading(false); // Hide loading screen
          
          // Wait additional time and manually translate alert text in the new language
          setTimeout(async () => {
            try {
              // Manually translate the alert text in the new language
              const titleText = newLanguage === 'English' ? 
                'Language Updated' : 
                await translateUIText('Language Updated', newLanguage, { userId: user.uid });
              
              const messageText = newLanguage === 'English' ?
                `Language changed to ${newLanguage}. The interface has been updated immediately.` :
                await translateUIText(`Language changed to ${newLanguage}. The interface has been updated immediately.`, newLanguage, { userId: user.uid });
              
              console.log(`🎉 Showing language change alert in ${newLanguage}:`, titleText);
              Alert.alert(titleText, messageText);
            } catch (error) {
              console.error('Error translating alert text:', error);
              // Fallback to English
              Alert.alert(
                'Language Updated', 
                `Language changed to ${newLanguage}. The interface has been updated immediately.`
              );
            }
          }, 1000); // 1 second delay for stability
        }, 3000); // 3 seconds for full language loading
      } else {
        setShowLanguageLoading(false);
        Alert.alert(
          t('error') || 'Error',
          t('failedToUpdateLanguage') || 'Failed to update language preference. Please try again.'
        );
      }
    } catch (error) {
      console.error('Error updating language:', error);
      setShowLanguageLoading(false);
      Alert.alert(
        t('error') || 'Error',
        t('failedToUpdateLanguage') || 'Failed to update language preference. Please try again.'
      );
    } finally {
      setSavingLanguage(false);
    }
  };

  const handleSave = async () => {
    // Validation
    if (!nickname || nickname.trim().length === 0) {
      Alert.alert(t('error'), t('pleaseEnterNickname'));
      return;
    }

    if (nickname.length > 20) {
      Alert.alert(t('error'), t('nicknameTooLong'));
      return;
    }

    if (!icon || icon.trim().length === 0) {
      Alert.alert(t('error'), t('pleaseEnterIcon'));
      return;
    }

    try {
      setSaving(true);
      
      await createUserProfile(user.uid, {
        email: user.email,
        displayName: nickname.trim(),
        nickname: nickname.trim(),
        icon: icon.trim(),
      });

      // Update presence with new profile data
      try {
        await setUserOnline(user.uid, {
          email: user.email,
          displayName: nickname.trim(),
          nickname: nickname.trim(),
          icon: icon.trim(),
        });
      } catch (presenceError) {
        console.log('Could not update presence:', presenceError.message);
      }

      Alert.alert(
        t('success') || 'Success',
        t('profileUpdated') || 'Profile updated! Your new nickname and icon will be visible immediately.',
        [
          {
            text: t('done'),
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert(t('error'), t('failedToSaveProfile', { error: error.message }) || `Failed to save profile: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    Alert.alert(
      t('signOut') || 'Sign Out',
      t('areYouSureSignOut') || 'Are you sure you want to sign out?',
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('signOut') || 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
    );
  }

  // Show language loading screen when changing languages
  if (showLanguageLoading) {
    return (
      <LanguageInitializationScreen 
        onComplete={() => setShowLanguageLoading(false)}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backText}>← {t('back')}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('profile') || 'Profile'}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView 
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.avatarContainer}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarIcon}>{icon}</Text>
            </View>
          </View>

          <View style={styles.infoSection}>
            <Text style={styles.label}>{t('email')}</Text>
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>{user?.email}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>{t('nickname')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('enterYourNickname') || 'Enter your nickname'}
              value={nickname}
              onChangeText={setNickname}
              autoCapitalize="words"
              maxLength={20}
              editable={!saving}
            />
            <Text style={styles.hint}>{t('nicknameHint') || 'This is how others will see you (max 20 characters)'}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>{t('iconPlaceholder') || 'Icon'}</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, styles.inputWithButton]}
                placeholder={t('enterEmoji') || 'Enter an emoji (e.g., 😊 or 🚀)'}
                value={icon}
                onChangeText={setIcon}
                maxLength={2}
                editable={!saving}
              />
              <TouchableOpacity
                style={styles.randomButton}
                onPress={handleRandomEmoji}
                disabled={saving}
              >
                <Text style={styles.randomButtonText}>🎲</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.hint}>{t('iconHint') || 'Your personal emoji avatar (or tap 🎲 for random)'}</Text>
          </View>

          {/* Language Preference Section */}
          <View style={styles.section}>
            <Text style={styles.label}>{t('languagePreference') || 'Language Preference'}</Text>
            <TouchableOpacity
              style={[styles.languageSelector, savingLanguage && styles.buttonDisabled]}
              onPress={handleLanguageSelection}
              disabled={savingLanguage}
            >
              <Text style={styles.languageSelectorText}>
                {languagePreference} 
              </Text>
              <Text style={styles.languageSelectorArrow}>
                {savingLanguage ? '⏳' : '▼'}
              </Text>
            </TouchableOpacity>
            {savingLanguage ? (
              <View style={styles.languageUpdatingContainer}>
                <Text style={styles.languageUpdatingText}>
                  🌐 {t('languageSettingsAdjusting') || 'Your language settings are adjusting...'}
                </Text>
              </View>
            ) : (
              <Text style={styles.hint}>
                {t('languagePreferenceHint') || 'Choose your preferred language for app interface and AI responses'}
              </Text>
            )}
          </View>

          <TouchableOpacity
            style={[styles.button, styles.saveButton, saving && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>{t('saveChanges') || 'Save Changes'}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.signOutButton]}
            onPress={handleSignOut}
            disabled={saving}
          >
            <Text style={styles.signOutButtonText}>{t('signOut') || 'Sign Out'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'android' ? 25 : 0, // Android status bar buffer
  },
  keyboardView: {
    flex: 1,
    paddingBottom: Platform.OS === 'android' ? 15 : 0, // Android navigation bar buffer
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: Platform.OS === 'android' ? 20 : 16, // Extra padding for Android
    paddingTop: Platform.OS === 'android' ? 10 : 16, // Android header buffer
    borderBottomWidth: 1,
    borderBottomColor: '#F1F1F1',
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  backText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
  },
  headerSpacer: {
    width: 70,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: Platform.OS === 'android' ? 30 : 20, // Extra top buffer for Android
    paddingBottom: Platform.OS === 'android' ? 60 : 40, // Extra bottom buffer for Android navigation
  },
  avatarContainer: {
    alignItems: 'center',
    marginVertical: 30,
  },
  avatarCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarIcon: {
    fontSize: 48,
  },
  infoSection: {
    marginBottom: 20,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
    marginBottom: 8,
  },
  infoBox: {
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    padding: 15,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  infoText: {
    fontSize: 16,
    color: '#666',
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inputWithButton: {
    flex: 1,
  },
  randomButton: {
    width: 50,
    height: 50,
    borderRadius: 10,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  randomButtonText: {
    fontSize: 24,
  },
  hint: {
    fontSize: 12,
    color: '#999',
    marginTop: 6,
    marginLeft: 4,
  },
  languageUpdatingContainer: {
    backgroundColor: '#E8F4FD',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  languageUpdatingText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
    textAlign: 'center',
  },
  languageSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    minHeight: 50,
  },
  languageSelectorText: {
    fontSize: 16,
    color: '#111',
    fontWeight: '500',
  },
  languageSelectorArrow: {
    fontSize: 14,
    color: '#999',
  },
  button: {
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  saveButton: {
    backgroundColor: '#007AFF',
  },
  signOutButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  buttonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  signOutButtonText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '600',
  },
});

