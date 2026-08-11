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

async function relayToOffscreen<T>(
  offscreenType: string,
  payload: Record<string, unknown> = {}
): Promise<T> {
  await ensureOffscreen();
  return new Promise<T>((resolve) => {
    chrome.runtime.sendMessage({ type: offscreenType, ...payload }, resolve);
  });
}

async function getFolders(): Promise<string[]> {
  const response = await relayToOffscreen<{ folders?: string[] }>("GET_FOLDERS");
  return response?.folders ?? ["Temp"];
}

async function captureAndShowStrip(): Promise<boolean> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const activeTab = tabs[0];
  if (!activeTab?.id) {
    return false;
  }

  const { dataUrl, captureError } = await new Promise<{
    dataUrl: string | undefined;
    captureError: chrome.runtime.LastError | undefined;
  }>((resolve) => {
    chrome.tabs.captureVisibleTab({ format: "png" }, (result) => {
      resolve({ dataUrl: result, captureError: chrome.runtime.lastError });
    });
  });

  if (captureError || !dataUrl) {
    console.error("BeHeld: capture failed", captureError);
    return false;
  }

  try {
    const [folders] = await Promise.all([
      getFolders(),
      relayToOffscreen("OFFSCREEN_ADD_CLIPBOARD_ITEM", {
        itemType: "image",
        content: dataUrl,
      }).catch((error) => {
        console.error("BeHeld: failed to record screenshot in clipboard history", error);
      }),
    ]);
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
    return true;
  } catch (error) {
    console.error("BeHeld: failed to get folders", error);
    return false;
  }
}

chrome.commands.onCommand.addListener((command) => {
  if (command === "take-screenshot") {
    captureAndShowStrip();
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "CAPTURE_SCREENSHOT") {
    captureAndShowStrip().then((success) => sendResponse({ success }));
    return true;
  }

  if (message.type === "OPEN_CLIPBOARD_STRIP") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (!activeTab?.id) {
        sendResponse({ success: false });
        return;
      }

      chrome.tabs.sendMessage(
        activeTab.id,
        { type: "SHOW_STRIP", dataUrl: null, folders: [], openClipboard: true },
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
    return true;
  }

  if (message.type === "OPEN_LIBRARY") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (!activeTab?.id) {
        sendResponse({ success: false });
        return;
      }

      getFolders().then((folders) => {
        chrome.tabs.sendMessage(
          activeTab.id!,
          { type: "SHOW_LIBRARY", folders },
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
    relayToOffscreen<{ success?: boolean }>("OFFSCREEN_SAVE", { folderName, dataUrl })
      .then((response) => sendResponse({ success: response?.success ?? false }))
      .catch((error) => {
        console.error("BeHeld: failed to save screenshot", error);
        sendResponse({ success: false });
      });
    return true;
  }

  if (message.type === "DELETE_FOLDER") {
    relayToOffscreen<{ success?: boolean }>("OFFSCREEN_DELETE_FOLDER", {
      folderName: message.folderName,
    })
      .then((response) => sendResponse({ success: response?.success ?? false }))
      .catch((error) => {
        console.error("BeHeld: failed to delete folder", error);
        sendResponse({ success: false });
      });
    return true;
  }

  if (message.type === "ADD_CLIPBOARD_ITEM") {
    relayToOffscreen<{ items?: unknown[] }>("OFFSCREEN_ADD_CLIPBOARD_ITEM", {
      itemType: message.itemType,
      content: message.content,
    })
      .then((response) => sendResponse({ items: response?.items ?? [] }))
      .catch((error) => {
        console.error("BeHeld: failed to add clipboard item", error);
        sendResponse({ items: [] });
      });
    return true;
  }

  if (message.type === "GET_CLIPBOARD_ITEMS") {
    relayToOffscreen<{ items?: unknown[] }>("OFFSCREEN_GET_CLIPBOARD_ITEMS")
      .then((response) => sendResponse({ items: response?.items ?? [] }))
      .catch((error) => {
        console.error("BeHeld: failed to get clipboard items", error);
        sendResponse({ items: [] });
      });
    return true;
  }

  if (message.type === "DELETE_CLIPBOARD_ITEM") {
    relayToOffscreen<{ items?: unknown[] }>("OFFSCREEN_DELETE_CLIPBOARD_ITEM", {
      id: message.id,
    })
      .then((response) => sendResponse({ items: response?.items ?? [] }))
      .catch((error) => {
        console.error("BeHeld: failed to delete clipboard item", error);
        sendResponse({ items: [] });
      });
    return true;
  }

  if (message.type === "GET_FOLDER_SUMMARY") {
    relayToOffscreen<{ counts?: Record<string, number> }>("OFFSCREEN_GET_FOLDER_SUMMARY")
      .then((response) => sendResponse({ counts: response?.counts ?? {} }))
      .catch((error) => {
        console.error("BeHeld: failed to get folder summary", error);
        sendResponse({ counts: {} });
      });
    return true;
  }

  if (message.type === "GET_FOLDER_CONTENTS") {
    relayToOffscreen<{ items?: unknown[]; hasOlder?: boolean; permissionDenied?: boolean }>(
      "OFFSCREEN_GET_FOLDER_CONTENTS",
      { folderName: message.folderName, includeOlder: message.includeOlder ?? false }
    )
      .then((response) =>
        sendResponse({
          items: response?.items ?? [],
          hasOlder: response?.hasOlder ?? false,
          permissionDenied: response?.permissionDenied ?? false,
        })
      )
      .catch((error) => {
        console.error("BeHeld: failed to get folder contents", error);
        sendResponse({ items: [], hasOlder: false, permissionDenied: false });
      });
    return true;
  }

  if (message.type === "CHECK_FOLDER_UNDER_ROOT") {
    relayToOffscreen<{ contained?: boolean }>("OFFSCREEN_CHECK_FOLDER_UNDER_ROOT", {
      folderName: message.folderName,
    })
      .then((response) => sendResponse({ contained: response?.contained ?? false }))
      .catch((error) => {
        console.error("BeHeld: failed to check folder under root", error);
        sendResponse({ contained: false });
      });
    return true;
  }

  if (message.type === "ADD_KNOWN_FOLDER") {
    relayToOffscreen<{ folders?: string[] }>("OFFSCREEN_ADD_KNOWN_FOLDER", {
      folderName: message.folderName,
    })
      .then((response) => sendResponse({ folders: response?.folders ?? [] }))
      .catch((error) => {
        console.error("BeHeld: failed to add known folder", error);
        sendResponse({ folders: [] });
      });
    return true;
  }

  if (message.type === "EXPORT_PDF") {
    relayToOffscreen<{ pdfDataUrl?: string | null }>("OFFSCREEN_EXPORT_PDF", {
      dataUrl: message.dataUrl,
    })
      .then((response) => sendResponse({ pdfDataUrl: response?.pdfDataUrl ?? null }))
      .catch((error) => {
        console.error("BeHeld: failed to export PDF", error);
        sendResponse({ pdfDataUrl: null });
      });
    return true;
  }

  if (message.type === "DELETE_SCREENSHOT") {
    relayToOffscreen<{ success?: boolean }>("OFFSCREEN_DELETE_SCREENSHOT", {
      folderName: message.folderName,
      filename: message.filename,
    })
      .then((response) => sendResponse({ success: response?.success ?? false }))
      .catch((error) => {
        console.error("BeHeld: failed to delete screenshot", error);
        sendResponse({ success: false });
      });
    return true;
  }
});
