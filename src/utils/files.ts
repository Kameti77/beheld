import { get, set } from "idb-keyval";

const FOLDERS_KEY = "beheld-folders";

async function getWritableRootHandle(): Promise<FileSystemDirectoryHandle | null> {
  const rootHandle = await get<FileSystemDirectoryHandle>("beheld-root-handle");
  if (!rootHandle) {
    console.error("BeHeld: no root handle found");
    return null;
  }

  const permission = await (rootHandle as unknown as {
    requestPermission: (desc: { mode: string }) => Promise<string>;
  }).requestPermission({ mode: "readwrite" });

  if (permission !== "granted") {
    console.error("BeHeld: permission denied");
    return null;
  }

  return rootHandle;
}

export async function saveScreenshot(
  folderName: string,
  dataUrl: string
): Promise<boolean> {
  try {
    const rootHandle = await getWritableRootHandle();
    if (!rootHandle) return false;

    // Get or create the subfolder
    const folderHandle = await rootHandle.getDirectoryHandle(folderName, {
      create: true,
    });

    // Generate unique filename
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, 19);
    const filename = `screenshot-${timestamp}.png`;

    // Convert base64 to blob
    const response = await fetch(dataUrl);
    const blob = await response.blob();

    // Write the file
    const fileHandle = await folderHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();

    // Save folder name to list
    const folders = await get<string[]>(FOLDERS_KEY) ?? ["Temp"];
    if (!folders.includes(folderName)) {
      await set(FOLDERS_KEY, [...folders, folderName]);
    }

    return true;
  } catch (error) {
    console.error("BeHeld save error:", error);
    return false;
  }
}

export async function deleteFolder(folderName: string): Promise<boolean> {
  try {
    const rootHandle = await getWritableRootHandle();
    if (!rootHandle) return false;

    try {
      await rootHandle.removeEntry(folderName, { recursive: true });
    } catch (error) {
      // Folder was already gone on disk — still clean up the stored list below.
      if ((error as DOMException).name !== "NotFoundError") throw error;
    }

    const folders = await get<string[]>(FOLDERS_KEY) ?? ["Temp"];
    await set(FOLDERS_KEY, folders.filter((f) => f !== folderName));

    return true;
  } catch (error) {
    console.error("BeHeld delete folder error:", error);
    return false;
  }
}
