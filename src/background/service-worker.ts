chrome.runtime.onInstalled.addListener(() => {
  console.log("BeHeld installed and running.");
});

async function ensureOffscreen() {
  const existing = await chrome.offscreen.hasDocument();
  if (!existing) {
    await chrome.offscreen.createDocument({
      url: "offscreen/offscreen.html",
      reasons: [chrome.offscreen.Reason.DOM_SCRAPING],
      justification: "Access IndexedDB to save screenshots via File System Access API",
    });
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "CAPTURE_SCREENSHOT") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (!activeTab?.id) return;

      chrome.tabs.captureVisibleTab({ format: "png" }, (dataUrl) => {
        chrome.tabs.sendMessage(activeTab.id!, {
          type: "SHOW_STRIP",
          dataUrl,
        });
        sendResponse({ success: true });
      });
    });
    return true;
  }

  if (message.type === "SAVE_SCREENSHOT") {
    const { folderName, dataUrl } = message;
    ensureOffscreen().then(() => {
      chrome.runtime.sendMessage(
        { type: "OFFSCREEN_SAVE", folderName, dataUrl },
        (response) => {
          sendResponse({ success: response?.success ?? false });
        }
      );
    });
    return true;
  }
});