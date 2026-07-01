import { get, set } from "idb-keyval";

const ROOT_HANDLE_KEY = "beheld-root-handle";
const FOLDERS_KEY = "beheld-folders";

// ── ROOT FOLDER HANDLE ─────────────────────────────────────

export async function getRootHandle(): Promise<FileSystemDirectoryHandle | null> {
  const handle = await get<FileSystemDirectoryHandle>(ROOT_HANDLE_KEY);
  return handle ?? null;
}

export async function saveRootHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  await set(ROOT_HANDLE_KEY, handle);
}

// ── FOLDER LIST ────────────────────────────────────────────

export async function getFolders(): Promise<string[]> {
  const folders = await get<string[]>(FOLDERS_KEY);
  return folders ?? ["Temp"];
}

export async function saveFolder(name: string): Promise<void> {
  const folders = await getFolders();
  if (!folders.includes(name)) {
    await set(FOLDERS_KEY, [...folders, name]);
  }
}