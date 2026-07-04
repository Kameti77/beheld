chrome.runtime.onInstalled.addListener(() => {
  console.log("BeHeld installed and running.");
});

// Path is relative to the extension root (i.e. the built dist/ folder), which
// mirrors manifest.json's other entries — NOT relative to this script's location.
const OFFSCREEN_DOCUMENT_PATH = "src/offscreen/offscreen.html";

async function ensureOffscreen() {
  const existing = await chrome.offscreen.hasDocument();
  if (existing) return;

  try {
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_DOCUMENT_PATH,
      reasons: [chrome.offscreen.Reason.DOM_SCRAPING],
      justification: "Access IndexedDB to save screenshots via File System Access API",
    });
  } catch (error) {
    // Ignore races where another SAVE_SCREENSHOT call created the document first.
    if (!(await chrome.offscreen.hasDocument())) throw error;
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "CAPTURE_SCREENSHOT") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (!activeTab?.id) {
        sendResponse({ success: false });
        return;
      }

      chrome.tabs.captureVisibleTab({ format: "png" }, (dataUrl) => {
        if (chrome.runtime.lastError || !dataUrl) {
          console.error("BeHeld: capture failed", chrome.runtime.lastError);
          sendResponse({ success: false });
          return;
        }

        chrome.tabs.sendMessage(
          activeTab.id!,
          { type: "SHOW_STRIP", dataUrl },
          () => {
            if (chrome.runtime.lastError) {
              console.error(
                "BeHeld: could not reach content script — reload the tab after updating the extension",
                chrome.runtime.lastError
              );
            }
          }
        );
        sendResponse({ success: true });
      });
    });
    return true;
  }

  if (message.type === "SAVE_SCREENSHOT") {
    const { folderName, dataUrl } = message;
    ensureOffscreen()
      .then(
        () =>
          new Promise<{ success: boolean }>((resolve) => {
            chrome.runtime.sendMessage(
              { type: "OFFSCREEN_SAVE", folderName, dataUrl },
              (response) => resolve({ success: response?.success ?? false })
            );
          })
      )
      .then(sendResponse)
      .catch((error) => {
        console.error("BeHeld: failed to save screenshot", error);
        sendResponse({ success: false });
      });
    return true;
  }
});