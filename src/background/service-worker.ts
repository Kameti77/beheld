chrome.runtime.onInstalled.addListener(() => {
  console.log("BeHeld installed and running.");
});

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
});