
# 🚇 Transit Time Auto-Calculator (Chrome Extension)

This Chrome extension calculates public transportation transit times automatically between candidate addresses listed on Viterbit and a selected destination.

## ✨ Features

- ✅ Automatically calculates transit times for each candidate listed.
- ✅ Displays the transit time clearly next to each candidate's name.
- ✅ Highlights the candidate's cell based on transit time duration.
- ✅ Supports dynamic pagination and filtering.
- ✅ Easy toggle to enable/disable automatic calculation.
- ✅ User-friendly interface with clean design.

## 🎨 Color Legend for Transit Times

Transit time durations are visually highlighted with colors for easy reference:

| Duration (minutes)        | Color          | Hex Code |
|---------------------------|----------------|----------|
| 25 minutes or less        | 🟢 Light Green | `#b3ffcc`|
| From 26 to 40 minutes     | 🟣 Light Purple| `#e0ccff`|
| From 41 to 60 minutes     | 🟠 Light Orange| `#ffdab3`|
| 61 minutes or more        | 🔴 Light Red   | `#ffb3b3`|

## 🔧 Setup

### Step 1: Clone Repository

```bash
git clone YOUR_REPOSITORY_URL.git
```

### Step 2: Install Extension

- Open Chrome and navigate to `chrome://extensions`
- Enable **Developer Mode**
- Click **"Load unpacked"** and select your cloned folder

### Step 3: Configure Google Maps API Key

Create a file named `config.js` in the root directory (this file is ignored by git for security):

```javascript
const GOOGLE_MAPS_API_KEY = 'YOUR_GOOGLE_MAPS_API_KEY';
```

- Obtain your API key from [Google Cloud Console](https://console.cloud.google.com)
- Enable the **Routes API (Distance Matrix)**

### Step 4: Enable Extension in Chrome

- Click the extension icon and enable **"Auto-calculate on Viterbit"**.
- Set your destination address.

## 📄 License

MIT © Learning on the Job SL
