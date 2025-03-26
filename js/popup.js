  // Inject API Key into storage securely (keep as-is)
  chrome.storage.local.set({ apiKey: GOOGLE_MAPS_API_KEY });

document.addEventListener('DOMContentLoaded', () => {
  const checkbox = document.getElementById('autoCalculate');
  const destinationInput = document.getElementById('destination');

  chrome.storage.local.get(['autoCalculate', 'destination'], (data) => {
    checkbox.checked = data.autoCalculate || false;
    destinationInput.value = data.destination || 'Puerta del Sol, Madrid';
  });

  checkbox.addEventListener('change', () => {
    chrome.storage.local.set({ autoCalculate: checkbox.checked });
  });

  destinationInput.addEventListener('input', debounce(() => {
    chrome.storage.local.set({ destination: destinationInput.value });
  }, 800)); // 800ms debounce (adjust if needed)

});

// Debounce helper function
function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
