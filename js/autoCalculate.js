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
//    setupObserver();
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


const checkInterval = setInterval(() => {
  const rows = document.querySelectorAll('tr.kt-datatable__row');
  if (rows.length > 1) { // Rows are loaded
    clearInterval(checkInterval);
    calculateAllTransitTimes();
  }
}, 1000); // checks every second

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
  if (!rows || rows.length < 2 || !apiKey) {
    console.error('API Key missing or no rows available.');
    return;
  }

  const originAddresses = [];
  const rowIndexMap = {};  // To map Google's originIndex to row

  for (let i = 1; i < rows.length; i++) {
    const streetEl = rows[i].querySelector('td[data-field="67c81d758da89225d90cf7cb"] span');
    const cityEl = rows[i].querySelector('td[data-field="city"] span');

    const street = streetEl ? streetEl.innerText.trim() : '';
    const city = cityEl ? cityEl.innerText.trim() : '';

    let origin = '';

    if (street && !street.toLowerCase().includes('no hay dirección')) {
      origin = street;
      if (city && !street.toLowerCase().includes(city.toLowerCase())) {
        origin += `, ${city}`;
      }
    } else if (city && !city.toLowerCase().includes('no hay dirección')) {
      origin = city;
    }

    if (!origin) {
      console.warn(`Skipping invalid address at row ${i}`);
      continue;
    }

    rowIndexMap[originAddresses.length] = rows[i];  // Map Google index to original row
    originAddresses.push({ waypoint: { address: origin } });
  }

  if (originAddresses.length === 0) {
    console.warn('No valid origin addresses found.');
    return;
  }

  try {
    const response = await fetch(`https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'duration,originIndex'
      },
      body: JSON.stringify({
        origins: originAddresses,
        destinations: [{ waypoint: { address: currentDestination } }],
        travelMode: 'TRANSIT'
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('API Error:', JSON.stringify(errorData, null, 2));
      return;
    }

    const data = await response.json();

    data.forEach((result) => {
      const originIdx = result.originIndex;
      const duration = result.duration;
      const row = rowIndexMap[originIdx];
    
      if (duration && row) {
        insertTransitTime(row, formatDuration(duration));
      } else if (row) {
        resetTransitTime(row);
        console.warn(`No duration found or invalid row for originIndex: ${originIdx}`);
      }
    });

  } catch (e) {
    console.error('Exception during API call:', e);
  }
}

// Insert calculated time into the DOM
function insertTransitTime(row, transitTime) {
  const nameCell = row.querySelector('.kt-user-card-v2__name')?.closest('.kt-datatable__cell');
  if (!nameCell) return;

  // Extract minutes from transitTime string
  const timeMatch = transitTime.match(/(?:(\d+) hr )?(\d+) min/);
  if (!timeMatch) return;

  const hours = parseInt(timeMatch[1] || '0', 10);
  const minutes = parseInt(timeMatch[2], 10);
  const totalMinutes = (hours * 60) + minutes;

  let bgColor;

  if (totalMinutes <= 25) {
    bgColor = '#b3ffcc'; // light green
  } else if (totalMinutes <= 40) {
    bgColor = '#e0ccff'; // light purple
  } else if (totalMinutes <= 60) {
    bgColor = '#ffdab3'; // light orange
  } else {
    bgColor = '#ffb3b3'; // light red
  }

  // Apply background color to the entire cell
  nameCell.style.backgroundColor = bgColor;
  nameCell.style.padding = '8px';
  nameCell.style.borderRadius = '4px';

  // Ensure transit time label is clearly visible (black color)
  const nameElement = nameCell.querySelector('.kt-user-card-v2__name');
  let span = nameElement.querySelector('.transit-time');
  if (!span) {
    span = document.createElement('span');
    span.className = 'transit-time';
    span.style.cssText = 'margin-left:8px;color:black;';
    nameElement.appendChild(span);
  }
  span.textContent = `(${transitTime})`;
}

function resetTransitTime(row) {
  const nameCell = row.querySelector('.kt-user-card-v2__name')?.closest('.kt-datatable__cell');
  if (!nameCell) return;

  // Reset background color and styling
  nameCell.style.backgroundColor = '';
  nameCell.style.padding = '';
  nameCell.style.borderRadius = '';

  // Remove transit time label if present
  const timeLabel = nameCell.querySelector('.transit-time');
  if (timeLabel) {
    timeLabel.remove();
  }
}

// Format duration nicely
function formatDuration(duration) {
  let s = parseInt(duration.replace('s', ''), 10), h = Math.floor(s / 3600), m = Math.ceil((s % 3600) / 60);
  return h ? `${h} hr ${m} min` : `${m} min`;
}