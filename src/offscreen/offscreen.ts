import { saveScreenshot } from "../utils/files";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "OFFSCREEN_SAVE") {
    saveScreenshot(message.folderName, message.dataUrl).then((success) => {
      sendResponse({ success });
    });
    return true;
  }
});
