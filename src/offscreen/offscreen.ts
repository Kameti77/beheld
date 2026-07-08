import { get, set } from "idb-keyval";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "OFFSCREEN_SAVE") {
    handleSave(message.folderName, message.dataUrl).then((success) => {
      sendResponse({ success });
    });
    return true;
  }

  if (message.type === "GET_FOLDERS") {
    get<string[]>("beheld-folders").then((folders) => {
      sendResponse({ folders: folders ?? ["Temp"] });
    });
    return true;
  }
});

async function handleSave(folderName: string, dataUrl: string): Promise<boolean> {
  try {
    const rootHandle = await get<FileSystemDirectoryHandle>("beheld-root-handle");
    if (!rootHandle) {
      console.error("Offscreen: no root handle found");
      return false;
    }

    const permission = await (rootHandle as unknown as {
      requestPermission: (desc: { mode: string }) => Promise<string>;
    }).requestPermission({ mode: "readwrite" });

    if (permission !== "granted") {
      console.error("Offscreen: permission denied");
      return false;
    }

    const folderHandle = await rootHandle.getDirectoryHandle(folderName, {
      create: true,
    });

    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, 19);
    const filename = `screenshot-${timestamp}.png`;

    const res = await fetch(dataUrl);
    const blob = await res.blob();

    const fileHandle = await folderHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();

    const folders = await get<string[]>("beheld-folders") ?? ["Temp"];
    if (!folders.includes(folderName)) {
      await set("beheld-folders", [...folders, folderName]);
    }

    return true;
  } catch (error) {
    console.error("Offscreen save error:", error);
    return false;
  }
}