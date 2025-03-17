let observer = null;
let currentDestination = 'Puerta del Sol, Madrid';
let autoCalculateEnabled = false;
let apiKey = null;

// Fetch initial settings from storage
chrome.storage.local.get(['apiKey'], (data) => {
  apiKey = data.apiKey;
});

chrome.storage.sync.get(['autoCalculate', 'destination'], (data) => {
  autoCalculateEnabled = data.autoCalculate || false;
  currentDestination = data.destination || currentDestination;

  if (autoCalculateEnabled) {
    setupObserver();
  }
});

// Listen for changes in storage
chrome.storage.onChanged.addListener((changes) => {
  if (changes.autoCalculate) {
    autoCalculateEnabled = changes.autoCalculate.newValue;
    autoCalculateEnabled ? setupObserver() : disconnectObserver();
  }
  if (changes.destination) {
    currentDestination = changes.destination.newValue;
    if (autoCalculateEnabled) calculateAllTransitTimes();
  }
  if (changes.apiKey) {
    apiKey = changes.apiKey.newValue;
  }
});

// Setup observer to detect page changes
function setupObserver() {
  if (observer) return;

  observer = new MutationObserver(debounce(() => {
    calculateAllTransitTimes();
  }, 500));

  observer.observe(document.body, { childList: true, subtree: true });

  calculateAllTransitTimes();
}

// Disconnect observer when not needed
function disconnectObserver() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}

// Debounce helper function
function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// Calculate transit times for each row
async function calculateAllTransitTimes() {
  const rows = document.querySelectorAll('tr.kt-datatable__row');
  if (!rows || rows.length < 2 || !apiKey) return;

  for (let i = 1; i < rows.length; i++) {
    const streetEl = rows[i].querySelector('td[data-field="67c81d758da89225d90cf7cb"] span');
    const cityEl = rows[i].querySelector('td[data-field="city"] span');

    const street = streetEl ? streetEl.innerText.trim() : '';
    const city = cityEl ? cityEl.innerText.trim() : '';
    const origin = street && city ? `${street}, ${city}` : (city || street);
    if (!origin) continue;

    try {
      const response = await fetch(`https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'duration'
        },
        body: JSON.stringify({
          origins: [{ waypoint: { address: origin } }],
          destinations: [{ waypoint: { address: currentDestination } }],
          travelMode: 'TRANSIT'
        })
      });

      const data = await response.json();
      if (data && data[0]?.duration) {
        insertTransitTime(rows[i], formatDuration(data[0].duration));
      }
    } catch (e) {
      console.error(`Error row ${i}:`, e);
    }
  }
}

// Insert calculated time into the DOM
function insertTransitTime(row, transitTime) {
  const nameEl = row.querySelector('.kt-user-card-v2__name');
  if (!nameEl) return;

  let span = nameEl.querySelector('.transit-time');
  if (!span) {
    span = document.createElement('span');
    span.className = 'transit-time';
    span.style.cssText = 'margin-left:8px;font-weight:bold;color:green;';
    nameEl.appendChild(span);
  }

  span.textContent = `(${transitTime})`;
}

// Format duration nicely
function formatDuration(duration) {
  let s = parseInt(duration.replace('s', ''), 10), h = Math.floor(s / 3600), m = Math.ceil((s % 3600) / 60);
  return h ? `${h} hr ${m} min` : `${m} min`;
}