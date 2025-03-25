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

  destinationInput.addEventListener('input', debounce(() => {
    chrome.storage.sync.set({ destination: destinationInput.value });
  }, 800)); // 800ms debounce (adjust if needed)

  // Inject API Key into storage securely (keep as-is)
  chrome.storage.sync.set({ apiKey: GOOGLE_MAPS_API_KEY });
});

// Debounce helper function
function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
