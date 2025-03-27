// Inject API Key into storage securely (keep as-is)
chrome.storage.local.set({ apiKey: GOOGLE_MAPS_API_KEY });

function saveAndSendDestination(address) {
  chrome.storage.local.set({ destination_address: address }, () => {
    console.log("Destino guardado:", address);

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: "destination_set",
        address: address
      });
      window.close();
    });
  });
}

document.getElementById("set-address").addEventListener("click", () => {
  const address = document.getElementById("destination").value.trim();
  if (!address) {
    alert("Please set a valid address");
    return;
  }
  saveAndSendDestination(address);
});

document.getElementById("destination").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const address = document.getElementById("destination").value.trim();
    if (!address) {
      alert("Please set a valid address");
      return;
    }
    saveAndSendDestination(address);
  }
});

// Load stored destination on popup open
chrome.storage.local.get(["destination_address"], (data) => {
  if (data.destination_address) {
    document.getElementById("destination").value = data.destination_address;
  }
});
