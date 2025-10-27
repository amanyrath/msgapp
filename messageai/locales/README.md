# 🌍 Static Localization System

## Overview

This directory contains pre-built locale files for instant app localization. This system eliminates API calls for supported languages, providing immediate loading and better performance.

## Supported Languages

- **English** (`en.json`) - Base language
- **Spanish** (`es.json`) - Complete translation
- **Japanese** (`ja.json`) - Complete translation
- **Khmer** (`km.json`) - Complete translation
- **Lao** (`lo.json`) - Complete translation

## How It Works

### Fast Path (Static Locales)
When a user's language is Spanish, Japanese, Khmer, or Lao:
1. ✅ **Instant loading** from static JSON files
2. ✅ **No API calls** required
3. ✅ **Offline support** included
4. ✅ **Consistent performance**

### Fallback Path (API Translation)
For other languages (French, German, etc.):
1. 🔄 Uses existing OpenAI translation system
2. 🔄 24-hour caching for performance
3. 🔄 Requires internet connection

## Adding New Languages

To add a new language (e.g., French):

1. **Create locale file**: `messageai/locales/fr.json`
2. **Translate all strings** from `en.json`
3. **Update localization.js**:
   ```javascript
   import frLocale from '../locales/fr.json';
   
   const STATIC_LOCALES = {
     'English': enLocale,
     'Spanish': esLocale, 
     'Japanese': jaLocale,
     'Khmer': kmLocale,
     'French': frLocale  // Add here
   };
   
   const SUPPORTED_STATIC_LANGUAGES = ['English', 'Spanish', 'Japanese', 'Khmer', 'Lao', 'French'];
   ```

## File Structure

```
messageai/locales/
├── README.md      # This documentation
├── en.json        # English (base)
├── es.json        # Spanish 
├── ja.json        # Japanese
├── km.json        # Khmer
└── lo.json        # Lao
```

## Key Features

- **216 UI strings** translated for each language (fully comprehensive)
- **Complete AI features coverage** including Smart Text Assistant, AI menu options, and translation UI
- **Parameter placeholders** preserved (e.g., `{error}`, `{chatTitle}`)
- **Emoji support** maintained across all languages
- **Cultural appropriateness** in translations
- **Consistent key structure** across all locale files
- **100% coverage** of all UI text including AI features, chat, authentication, and settings

## Usage in Components

The localization system is used via the `LocalizationContext`:

```javascript
import { useLocalization } from '../context/LocalizationContext';

function MyComponent() {
  const { t, hasStaticLocaleSupport } = useLocalization();
  
  // Use translated strings
  const backButton = t('back'); // "Volver" in Spanish, "戻る" in Japanese
  
  // Check if language has fast loading
  const isFast = hasStaticLocaleSupport('Spanish'); // true
  
  return <Text>{backButton}</Text>;
}
```

## Performance Benefits

- **Spanish/Japanese/Khmer**: ~0ms loading (static import)
- **Other languages**: ~200-500ms (API + caching)
- **Reduced API costs** for supported languages
- **Better user experience** with instant UI updates

## Maintenance

When adding new UI strings:
1. Add to `DEFAULT_UI_STRINGS` in `localization.js`
2. Add translations to all static locale files
3. Keep parameter placeholders consistent
4. Test with the verification script

This system provides the best of both worlds: instant loading for major languages while maintaining universal language support through API fallback.
