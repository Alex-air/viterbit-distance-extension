let apiKey = null;
let currentDestination = 'Puerta del Sol, Madrid';
let observer;

chrome.storage.local.get(['apiKey'], (data) => {
  apiKey = data.apiKey;
});

chrome.storage.sync.get(['destination'], (data) => {
  currentDestination = data.destination || currentDestination;
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.destination) {
    currentDestination = changes.destination.newValue;
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

function setupObserver() {
  const tableBody = document.querySelector('table');
  if (!tableBody) return;

  observer = new MutationObserver(debounce(() => {
    const rows = document.querySelectorAll('tr.kt-datatable__row');
    if (rows.length > 1) {
      calculateAllTransitTimes();
    }
  }, 800));

  observer.observe(tableBody, { childList: true, subtree: true });
}

const observerCheckInterval = setInterval(() => {
  const tableBody = document.querySelector('table');
  if (tableBody && document.querySelectorAll('tr.kt-datatable__row').length > 1) {
    clearInterval(observerCheckInterval);
    setupObserver();
    calculateAllTransitTimes();
  }
}, 1000);

async function calculateAllTransitTimes() {
  if (observer) observer.disconnect();

  const rows = document.querySelectorAll('tr.kt-datatable__row');
  if (!rows || rows.length < 2 || !apiKey) {
    if (observer) setupObserver();
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
    if (observer) setupObserver();
    return;
  }

  try {
    console.log("API called");
    
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
      if (observer) setupObserver();
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
    console.error('API call error:', e);
  } finally {
    if (observer) setupObserver();
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