# 🌍 Multilingual Support (i18n)

This project supports **3 languages**:
- 🇺🇸 **English** (en)
- 🇻🇳 **Tiếng Việt** (vi)
- 🇯🇵 **日本語** (ja)

## 📦 Installation

Run the following command to install i18n dependencies:

```bash
cd frontend
pnpm install
```

## 🚀 Usage

The language switcher is automatically added to the navigation bar. Users can click the globe icon to switch between languages.

## 📁 Project Structure

```
frontend/src/
├── i18n/
│   ├── config.ts           # i18n configuration
│   └── locales/
│       ├── en.json          # English translations
│       ├── vi.json          # Vietnamese translations
│       └── ja.json          # Japanese translations
├── components/ui/
│   └── LanguageSwitcher.tsx # Language switcher component
```

## 🔧 How to Use Translations in Components

```tsx
import { useTranslation } from 'react-i18next'

function MyComponent() {
  const { t } = useTranslation()
  
  return (
    <div>
      <h1>{t('hero.title')}</h1>
      <p>{t('hero.description')}</p>
    </div>
  )
}
```

## ➕ Adding New Translations

1. Open the translation files in `src/i18n/locales/`
2. Add your new keys to all language files:

```json
{
  "mySection": {
    "title": "My Title",
    "description": "My Description"
  }
}
```

3. Use in your component:

```tsx
{t('mySection.title')}
{t('mySection.description')}
```

## 🎯 Features

- ✅ Automatic language detection from browser
- ✅ Language persistence in localStorage
- ✅ Easy-to-use dropdown selector
- ✅ Full TypeScript support
- ✅ All main pages translated (Home, Navigation, Footer)

## 🛠️ Technical Details

- **Library**: `react-i18next` + `i18next`
- **Language Detection**: `i18next-browser-languagedetector`
- **Default Language**: English (en)
- **Fallback Language**: English (en)

## 📝 Notes

- The selected language is saved in browser's `localStorage`
- The language persists across page refreshes
- Users can switch language at any time using the globe icon in the navigation bar
