document.addEventListener('DOMContentLoaded', () => {
  const checkbox = document.getElementById('autoCalculate');
  const destinationInput = document.getElementById('destination');

  chrome.storage.sync.get(['autoCalculate', 'destination'], (data) => {
    checkbox.checked = data.autoCalculate || false;
    destinationInput.value = data.destination || 'Puerta del Sol, Madrid';
  });

  checkbox.addEventListener('change', () => {
    chrome.storage.sync.set({ autoCalculate: checkbox.checked });
  });

  destinationInput.addEventListener('input', () => {
    chrome.storage.sync.set({ destination: destinationInput.value });
  });

  // Inject API Key into storage securely
  chrome.storage.local.set({ apiKey: GOOGLE_MAPS_API_KEY });
});
