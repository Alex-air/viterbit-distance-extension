// === autoCalculate.js ===

console.log("autoCalculate.js loaded");

const STORAGE_KEY = "transit_cache";
const STORAGE_LIMIT_BYTES = 4 * 1024 * 1024; // 4MB limit for chrome.storage.local
const STORAGE_THRESHOLD_BYTES = 3.5 * 1024 * 1024; // Clean if usage exceeds 3.5MB

function getNextMonday0830CET() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysUntilMonday = (8 - dayOfWeek) % 7 || 7;
  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + daysUntilMonday);
  nextMonday.setUTCHours(6, 30, 0, 0); // 08:30 CET = 06:30 UTC
  return Math.floor(nextMonday.getTime() / 1000);
}

function parseCsvData(csvString) {
  const lines = csvString.split("\n");
  const data = {};
  lines.forEach((line) => {
    const [origin, duration] = line.split("|");
    if (origin && duration) {
      data[origin.trim().toLowerCase()] = duration.trim();
    }
  });
  return data;
}

function encodeCsvData(data) {
  return Object.entries(data).map(([origin, duration]) => `${origin}|${duration}`).join("\n");
}

function getAddressFromRow(row) {
  const streetCell = row.querySelector('[data-field="67c81d758da89225d90cf7cb"] span');
  const cityCell = row.querySelector('[data-field="city"] span');
  const street = streetCell?.innerText.trim() || "";
  const city = cityCell?.innerText.trim() || "";
  const headerCheck = street.toLowerCase().includes("dirección domicilio completa") || city.toLowerCase().includes("ciudad");
  return (!headerCheck && street && city) ? `${street}, ${city}` : null;
}

function applyTransitResult(row, durationSec) {
  const nameLink = row.querySelector(".kt-user-card-v2__name");
  if (!nameLink) return;

  const existingLabel = nameLink.querySelector(".transit-label");
  if (existingLabel) existingLabel.remove();

  const label = document.createElement("strong");
  label.className = "transit-label";

  let minutes = null;
  let backgroundColor = "";

  if (durationSec === "-1") {
    label.textContent = " (- min)";
    backgroundColor = "#ffe6e6";
  } else {
    const seconds = parseInt(durationSec);
    minutes = Math.round(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    label.textContent = hours > 0 ? ` (${hours}h ${remainingMinutes}min)` : ` (${minutes} min)`;

    if (minutes <= 25) backgroundColor = "#ccffcc";
    else if (minutes <= 40) backgroundColor = "#e5ccff";
    else if (minutes <= 60) backgroundColor = "#ffe5cc";
    else backgroundColor = "#ffcccc";
  }

  label.style.marginLeft = "6px";
  nameLink.appendChild(label);

  const targetCell = nameLink.closest(".kt-datatable__cell");
  if (targetCell) targetCell.style.backgroundColor = backgroundColor;
}

function autoCleanupIfStorageTooLarge(cache) {
  const totalString = JSON.stringify(cache);
  const sizeInBytes = new Blob([totalString]).size;
  if (sizeInBytes >= STORAGE_THRESHOLD_BYTES) {
    console.warn("⚠️ Storage usage approaching limit. Cleaning up...");
    const keys = Object.keys(cache.data);
    keys.sort(() => Math.random() - 0.5);
    while (new Blob([JSON.stringify(cache)]).size >= STORAGE_THRESHOLD_BYTES && keys.length > 0) {
      const toRemove = keys.pop();
      delete cache.data[toRemove];
      console.log(`🧹 Removed cache for: ${toRemove}`);
    }
  }
  return cache;
}

function logCacheStats(cache) {
  const destinations = Object.keys(cache.data);
  let totalEntries = 0;
  destinations.forEach((k) => {
    const lines = cache.data[k].split("\n").length;
    console.log(`🗂 ${k} -> ${lines} entries`);
    totalEntries += lines;
  });
  const totalSize = new Blob([JSON.stringify(cache)]).size;
  console.log(`📊 Total cache entries: ${totalEntries}`);
  console.log(`💾 Estimated storage usage: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
}

function calculateAndCacheTransitTimes(destination, uncachedOrigins, originRowMap, cache, cacheDataKey) {
  console.log("Calling API for:", uncachedOrigins);
  const originWaypoints = uncachedOrigins.map((address) => ({ waypoint: { address } }));
  const requestBody = {
    origins: originWaypoints,
    destinations: [{ waypoint: { address: destination } }],
    travelMode: "TRANSIT",
    languageCode: "es",
    departureTime: { seconds: getNextMonday0830CET() }
  };

  chrome.storage.local.get(["apiKey"], (config) => {
    const apiKey = config.apiKey;
    fetch(`https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'duration,originIndex'
      },
      body: JSON.stringify(requestBody)
    })
      .then((res) => res.json())
      .then((results) => {
        console.log("API response:", results);

        const updatedCsvData = parseCsvData(cache.data[cacheDataKey] || "");
        results.forEach((result) => {
          const index = result.originIndex;
          const origin = uncachedOrigins[index];
          if (!origin) {
            console.warn("⚠️ Missing origin for index:", index, result);
            return;
          }
          const row = originRowMap.get(origin.toLowerCase());

          const durationSec = result?.duration?.seconds || parseInt(result?.duration?.replace("s", ""));
          if (durationSec && !isNaN(durationSec)) {
            updatedCsvData[origin.toLowerCase()] = durationSec;
            applyTransitResult(row, durationSec);
          } else if (row) {
            console.warn(`No duration for: ${origin}`, result);
            updatedCsvData[origin.toLowerCase()] = "-1";
            applyTransitResult(row, "-1");
          }
        });

        cache.data[cacheDataKey] = encodeCsvData(updatedCsvData);
        const cleanedCache = autoCleanupIfStorageTooLarge(cache);
        chrome.storage.local.set({ [STORAGE_KEY]: cleanedCache }, () => {
          console.log("✅ Cache saved after API call and cleanup");
          logCacheStats(cleanedCache);
        });
      });
  });
}

function processPage(destination) {
  chrome.storage.local.get([STORAGE_KEY], (result) => {
    const normalizedDestination = destination.trim().toLowerCase();
    let cache = result[STORAGE_KEY] || { data: {} };

    const rows = [...document.querySelectorAll("tr.kt-datatable__row")].filter(
      (row) => row.querySelector('[data-field="name"]') !== null
    );

    const cacheDataKey = normalizedDestination;
    const cachedCsv = cache.data[cacheDataKey] || "";
    const cachedData = parseCsvData(cachedCsv);

    const uncachedOrigins = [];
    const originRowMap = new Map();

    rows.forEach((row) => {
      const origin = getAddressFromRow(row);
      if (!origin) return;

      const lowerOrigin = origin.toLowerCase();
      const durationValue = cachedData[lowerOrigin];
      if (durationValue !== undefined) {
        applyTransitResult(row, durationValue);
      } else {
        uncachedOrigins.push(origin);
        originRowMap.set(lowerOrigin, row);
      }
    });

    if (uncachedOrigins.length > 0) {
      calculateAndCacheTransitTimes(destination, uncachedOrigins, originRowMap, cache, cacheDataKey);
    } else {
      console.log("All values cached for destination:", destination);
      logCacheStats(cache);
    }
  });
}

function waitForRowsAndRun(callback) {
  const interval = setInterval(() => {
    const rowsReady = document.querySelectorAll("tr.kt-datatable__row").length > 0;
    if (rowsReady) {
      clearInterval(interval);
      callback();
    }
  }, 300);
}

let intervalId = null;
let lastRowSignature = "";

function setupInitialCheck(destination) {
  if (intervalId) clearInterval(intervalId);

  intervalId = setInterval(() => {
    const rows = document.querySelectorAll("tr.kt-datatable__row");
    const currentSignature = [...rows]
      .map(row => row.innerText.trim().slice(0, 100))
      .join("|");

    if (currentSignature !== lastRowSignature) {
      lastRowSignature = currentSignature;
      console.log("🔄 Detected table content change, refreshing...");
      processPage(destination);
    }
  }, 1000);
}

chrome.storage.local.get(["destination_address"], (data) => {
  if (data.destination_address) {
    waitForRowsAndRun(() => {
      console.log("Auto-launching with destination:", data.destination_address);
      processPage(data.destination_address);
      setupInitialCheck(data.destination_address);
    });
  }
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "destination_set" && msg.address) {
    console.log("Received destination:", msg.address);
    processPage(msg.address);
    setupInitialCheck(msg.address);
  }
});
