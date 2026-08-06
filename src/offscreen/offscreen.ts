import { get, set } from "idb-keyval";
import { jsPDF } from "jspdf";

const CLIPBOARD_KEY = "beheld-clipboard";
const MAX_CLIPBOARD_ITEMS = 50;

interface ClipboardEntry {
  id: string;
  itemType: "text" | "image";
  content: string;
  timestamp: number;
}

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

  if (message.type === "OFFSCREEN_DELETE_FOLDER") {
    handleDeleteFolder(message.folderName).then((success) => {
      sendResponse({ success });
    });
    return true;
  }

  if (message.type === "OFFSCREEN_ADD_CLIPBOARD_ITEM") {
    addClipboardItem(message.itemType, message.content).then((items) => {
      sendResponse({ items });
    });
    return true;
  }

  if (message.type === "OFFSCREEN_GET_CLIPBOARD_ITEMS") {
    get<ClipboardEntry[]>(CLIPBOARD_KEY).then((items) => {
      sendResponse({ items: items ?? [] });
    });
    return true;
  }

  if (message.type === "OFFSCREEN_DELETE_CLIPBOARD_ITEM") {
    deleteClipboardItem(message.id).then((items) => {
      sendResponse({ items });
    });
    return true;
  }

  if (message.type === "OFFSCREEN_GET_FOLDER_SUMMARY") {
    getFolderSummary().then((counts) => {
      sendResponse({ counts });
    });
    return true;
  }

  if (message.type === "OFFSCREEN_GET_FOLDER_CONTENTS") {
    getFolderContents(message.folderName).then((items) => {
      sendResponse({ items });
    });
    return true;
  }

  if (message.type === "OFFSCREEN_CHECK_FOLDER_UNDER_ROOT") {
    checkFolderUnderRoot(message.folderName).then((contained) => {
      sendResponse({ contained });
    });
    return true;
  }

  if (message.type === "OFFSCREEN_ADD_KNOWN_FOLDER") {
    addKnownFolder(message.folderName).then((folders) => {
      sendResponse({ folders });
    });
    return true;
  }

  if (message.type === "OFFSCREEN_DELETE_SCREENSHOT") {
    deleteScreenshot(message.folderName, message.filename).then((success) => {
      sendResponse({ success });
    });
    return true;
  }

  if (message.type === "OFFSCREEN_EXPORT_PDF") {
    exportPdf(message.dataUrl).then((pdfDataUrl) => {
      sendResponse({ pdfDataUrl });
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

async function handleDeleteFolder(folderName: string): Promise<boolean> {
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

    try {
      await rootHandle.removeEntry(folderName, { recursive: true });
    } catch (error) {
      // Already gone on disk — still clean up the stored list below.
      if ((error as DOMException).name !== "NotFoundError") throw error;
    }

    const folders = await get<string[]>("beheld-folders") ?? ["Temp"];
    await set("beheld-folders", folders.filter((f) => f !== folderName));

    return true;
  } catch (error) {
    console.error("Offscreen delete folder error:", error);
    return false;
  }
}

// Best-effort stand-in for a real ancestry check. A handle picked via the content
// script's own showDirectoryPicker() call belongs to the host page's origin, while
// rootHandle here belongs to chrome-extension://<id> — the WHATWG File System spec's
// handle serialization steps record the origin at serialize-time and require an exact
// match at deserialize-time, so that picked handle can never be sent to this document
// for a true resolve()/isSameEntry() identity check. The closest verifiable signal
// available without the live handle is name equality against root's own direct
// children, which only recognizes the case where the picked folder is already a known
// top-level child of root — it cannot detect a genuinely new folder nested more than
// one level deep (out of scope for this flat, single-segment folder model), and could
// theoretically false-positive on an unrelated folder that happens to share a name.
async function checkFolderUnderRoot(folderName: string): Promise<boolean> {
  try {
    const rootHandle = await get<FileSystemDirectoryHandle>("beheld-root-handle");
    if (!rootHandle) return false;
    await rootHandle.getDirectoryHandle(folderName);
    return true;
  } catch {
    return false;
  }
}

async function addKnownFolder(folderName: string): Promise<string[]> {
  const folders = await get<string[]>("beheld-folders") ?? ["Temp"];
  if (folders.includes(folderName)) return folders;
  const updated = [...folders, folderName];
  await set("beheld-folders", updated);
  return updated;
}

async function addClipboardItem(
  itemType: "text" | "image",
  content: string
): Promise<ClipboardEntry[]> {
  const items = await get<ClipboardEntry[]>(CLIPBOARD_KEY) ?? [];

  const entry: ClipboardEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    itemType,
    content,
    timestamp: Date.now(),
  };

  const updated = [entry, ...items].slice(0, MAX_CLIPBOARD_ITEMS);
  await set(CLIPBOARD_KEY, updated);
  return updated;
}

async function deleteClipboardItem(id: string): Promise<ClipboardEntry[]> {
  const items = await get<ClipboardEntry[]>(CLIPBOARD_KEY) ?? [];
  const updated = items.filter((item) => item.id !== id);
  await set(CLIPBOARD_KEY, updated);
  return updated;
}

interface FolderContentItem {
  filename: string;
  thumbnailDataUrl: string;
}

async function getFolderSummary(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  try {
    const rootHandle = await get<FileSystemDirectoryHandle>("beheld-root-handle");
    const folders = await get<string[]>("beheld-folders") ?? ["Temp"];
    if (!rootHandle) return counts;

    for (const folderName of folders) {
      try {
        const folderHandle = await rootHandle.getDirectoryHandle(folderName);
        let count = 0;
        for await (const [, handle] of folderHandle.entries()) {
          if (handle.kind === "file") count++;
        }
        counts[folderName] = count;
      } catch {
        counts[folderName] = 0;
      }
    }
  } catch (error) {
    console.error("Offscreen folder summary error:", error);
  }
  return counts;
}

const THUMBNAIL_MAX_SIZE = 120;

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (error) => {
      URL.revokeObjectURL(url);
      reject(error);
    };
    img.src = url;
  });
}

async function createThumbnail(blob: Blob): Promise<string> {
  const img = await loadImageFromBlob(blob);
  const scale = THUMBNAIL_MAX_SIZE / Math.max(img.naturalWidth, img.naturalHeight);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Offscreen: canvas context unavailable for thumbnail");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

async function getFolderContents(folderName: string): Promise<FolderContentItem[]> {
  const items: FolderContentItem[] = [];
  try {
    const rootHandle = await get<FileSystemDirectoryHandle>("beheld-root-handle");
    if (!rootHandle) return items;

    const folderHandle = await rootHandle.getDirectoryHandle(folderName);
    for await (const [name, handle] of folderHandle.entries()) {
      if (handle.kind !== "file") continue;
      try {
        const file = await handle.getFile();
        const thumbnailDataUrl = await createThumbnail(file);
        items.push({ filename: name, thumbnailDataUrl });
      } catch (error) {
        console.error(`Offscreen: failed to build thumbnail for ${name}`, error);
      }
    }
  } catch (error) {
    console.error("Offscreen folder contents error:", error);
  }
  return items;
}

async function deleteScreenshot(folderName: string, filename: string): Promise<boolean> {
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

    const folderHandle = await rootHandle.getDirectoryHandle(folderName);
    await folderHandle.removeEntry(filename);
    return true;
  } catch (error) {
    console.error("Offscreen delete screenshot error:", error);
    return false;
  }
}

function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

const PDF_PAGE_MARGIN = 20;

async function exportPdf(dataUrl: string): Promise<string | null> {
  try {
    const img = await loadImageFromDataUrl(dataUrl);
    const doc = new jsPDF({
      orientation: img.naturalWidth >= img.naturalHeight ? "landscape" : "portrait",
      unit: "pt",
      format: "a4",
    });

    const pageWidth = doc.internal.pageSize.getWidth() - PDF_PAGE_MARGIN * 2;
    const pageHeight = doc.internal.pageSize.getHeight() - PDF_PAGE_MARGIN * 2;
    const scale = Math.min(pageWidth / img.naturalWidth, pageHeight / img.naturalHeight);
    const imgWidth = img.naturalWidth * scale;
    const imgHeight = img.naturalHeight * scale;
    const x = (doc.internal.pageSize.getWidth() - imgWidth) / 2;
    const y = (doc.internal.pageSize.getHeight() - imgHeight) / 2;

    doc.addImage(dataUrl, "PNG", x, y, imgWidth, imgHeight);
    return doc.output("datauristring");
  } catch (error) {
    console.error("Offscreen export PDF error:", error);
    return null;
  }
}
