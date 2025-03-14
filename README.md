
# 🚇 Transit Time Auto-Calculator (Chrome Extension)

This Chrome extension calculates public transportation transit times automatically between candidate addresses and a specified destination on Viterbit.

## ✨ Features

- Automatically calculates transit time from candidate addresses to a specified destination.
- Displays transit times clearly next to each candidate's name.
- Easy toggle (checkbox) to enable or disable automatic calculation.
- Stylish, user-friendly popup interface.

## 🔧 Installation

### Step 1: Clone Repository

```bash
git clone YOUR_REPOSITORY_URL.git
```

### Step 2: Setup Your API Key

Create a file named `config.js` in the root folder with your Google Maps API key:

```javascript
const GOOGLE_MAPS_API_KEY = 'YOUR_GOOGLE_MAPS_API_KEY';
```

> ⚠️ **Important**: Never commit your `config.js` file to version control.

### Step 3: Load Extension in Chrome

- Open Chrome and go to `chrome://extensions`.
- Activate **Developer Mode**.
- Click **"Load unpacked"** and select the extension folder.

## ⚙️ API Configuration

- Get your Google Maps API Key from [Google Cloud Console](https://console.cloud.google.com).
- Enable the **Routes API (Distance Matrix)** service.

## 🚩 Important Notes

- Ensure your billing and quotas on Google Cloud are configured correctly.
- Always keep your API key secure.

## 📝 `.gitignore`

Create a `.gitignore` file containing:

```
config.js
```

---

Enjoy your enhanced candidate management with effortless transit time calculations! 🚀
