let apiKey = null;
let currentDestination = 'Puerta del Sol, Madrid';

chrome.storage.local.get(['apiKey'], (data) => {
  apiKey = data.apiKey;
});

chrome.storage.sync.get(['destination'], (data) => {
  currentDestination = data.destination || currentDestination;
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.destination) {
    currentDestination = changes.destination.newValue;
    calculateAllTransitTimes();
  }
  if (changes.apiKey) {
    apiKey = changes.apiKey.newValue;
  }
});

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

let isCalculating = false;

function setupObserver() {
  const tableBody = document.querySelector('table');

  if (!tableBody) {
    console.error('Table not found for observer setup.');
    return;
  }

  const observer = new MutationObserver(debounce(() => {
    if (!isCalculating) {
      calculateAllTransitTimes();
    } else {
      console.log('Calculation already running, skipped extra call.');
    }
  }, 800));

  observer.observe(tableBody, {
    childList: true,
    subtree: true,
  });
}

const initialCheckInterval = setInterval(() => {
  if (document.querySelectorAll('tr.kt-datatable__row').length > 1) {
    clearInterval(initialCheckInterval);
    calculateAllTransitTimes();
    setupObserver();
  }
}, 1000);

async function calculateAllTransitTimes() {
  if (isCalculating) {
    console.warn('Calculation in progress, skipped extra call.');
    return;
  }

  isCalculating = true;
  console.log('Starting API call...');

  const rows = document.querySelectorAll('tr.kt-datatable__row');
  if (!rows || rows.length < 2 || !apiKey) {
    console.error('API Key missing or no rows available.');
    return;
  }

  const originAddresses = [];
  const rowIndexMap = {};

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
      resetTransitTime(rows[i]);
      continue;
    }

    rowIndexMap[originAddresses.length] = rows[i];
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

    console.log('API call sent');

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
      }
    });

  } catch (e) {
    console.error('Exception during API call:', e);
  }
  finally {
    isCalculating = false;
    console.log('API call finished.');
  }
}

function insertTransitTime(row, transitTime) {
  const nameCell = row.querySelector('.kt-user-card-v2__name')?.closest('.kt-datatable__cell');
  if (!nameCell) return;

  const timeMatch = transitTime.match(/(?:(\d+) hr )?(\d+) min/);
  if (!timeMatch) return;

  const hours = parseInt(timeMatch[1] || '0', 10);
  const minutes = parseInt(timeMatch[2], 10);
  const totalMinutes = (hours * 60) + minutes;

  let bgColor;

  if (totalMinutes <= 25) bgColor = '#b3ffcc';
  else if (totalMinutes <= 40) bgColor = '#e0ccff';
  else if (totalMinutes <= 60) bgColor = '#ffdab3';
  else bgColor = '#ffb3b3';

  nameCell.style.backgroundColor = bgColor;
  nameCell.style.padding = '8px';
  nameCell.style.borderRadius = '4px';

  let span = nameCell.querySelector('.transit-time');
  if (!span) {
    span = document.createElement('span');
    span.className = 'transit-time';
    span.style.cssText = 'margin-left:8px;color:black;';
    nameCell.querySelector('.kt-user-card-v2__name').appendChild(span);
  }
  span.textContent = `(${transitTime})`;
}

function resetTransitTime(row) {
  const nameCell = row.querySelector('.kt-user-card-v2__name')?.closest('.kt-datatable__cell');
  if (!nameCell) return;

  nameCell.style.backgroundColor = '';
  nameCell.style.padding = '';
  nameCell.style.borderRadius = '';

  const timeLabel = nameCell.querySelector('.transit-time');
  if (timeLabel) timeLabel.remove();
}

function formatDuration(duration) {
  let s = parseInt(duration.replace('s', ''), 10);
  let h = Math.floor(s / 3600);
  let m = Math.ceil((s % 3600) / 60);
  return h ? `${h} hr ${m} min` : `${m} min`;
}

