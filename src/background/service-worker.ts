chrome.runtime.onInstalled.addListener(() => {
  console.log("BeHeld installed and running.");
});

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
    if (!(await chrome.offscreen.hasDocument())) throw error;
  }
}

async function getFolders(): Promise<string[]> {
  await ensureOffscreen();
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: "GET_FOLDERS" },
      (response) => {
        resolve(response?.folders ?? ["Temp"]);
      }
    );
  });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "CAPTURE_SCREENSHOT") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (!activeTab?.id) {
        sendResponse({ success: false });
        return;
      }

      chrome.tabs.captureVisibleTab({ format: "png" }, async (dataUrl) => {
        if (chrome.runtime.lastError || !dataUrl) {
          console.error("BeHeld: capture failed", chrome.runtime.lastError);
          sendResponse({ success: false });
          return;
        }

        try {
          const folders = await getFolders();
          chrome.tabs.sendMessage(
            activeTab.id!,
            { type: "SHOW_STRIP", dataUrl, folders },
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
        } catch (error) {
          console.error("BeHeld: failed to get folders", error);
          sendResponse({ success: false });
        }
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