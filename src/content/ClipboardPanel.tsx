import { useEffect, useState } from "react";

// ── TYPES ──────────────────────────────────────────────────
export interface ClipboardEntry {
  id: string;
  itemType: "text" | "image";
  content: string;
  timestamp: number;
}

// ── LIVE CLIPBOARD UPDATES ─────────────────────────────────
// Lets any mounted panel react immediately when new items are recorded,
// instead of requiring the panel to be closed and reopened.
type ClipboardListener = (items: ClipboardEntry[]) => void;
export const clipboardListeners = new Set<ClipboardListener>();

export function notifyClipboardListeners(items: ClipboardEntry[]) {
  clipboardListeners.forEach((listener) => listener(items));
}

export function formatRelativeTime(timestamp: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export async function copyImageToClipboard(dataUrl: string) {
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
  } catch (error) {
    console.error("BeHeld: failed to copy image, falling back to text", error);
    await navigator.clipboard.writeText(dataUrl);
  }
}

// ── SHARED CLIPBOARD ITEMS HOOK ─────────────────────────────
// Fetches on demand (call load()) and stays live-updated via clipboardListeners,
// so DecisionStrip's and LibraryPanel's clipboard tabs never drift out of sync.
export function useClipboardItems() {
  const [items, setItems] = useState<ClipboardEntry[]>([]);

  useEffect(() => {
    const listener = (updated: ClipboardEntry[]) => setItems(updated);
    clipboardListeners.add(listener);
    return () => {
      clipboardListeners.delete(listener);
    };
  }, []);

  const load = () => {
    chrome.runtime.sendMessage({ type: "GET_CLIPBOARD_ITEMS" }, (response) => {
      setItems(response?.items ?? []);
    });
  };

  const deleteItem = (id: string) => {
    chrome.runtime.sendMessage({ type: "DELETE_CLIPBOARD_ITEM", id }, (response) => {
      setItems(response?.items ?? []);
    });
  };

  const recopy = async (item: ClipboardEntry) => {
    if (item.itemType === "text") {
      await navigator.clipboard.writeText(item.content);
    } else {
      await copyImageToClipboard(item.content);
    }
  };

  return { items, load, deleteItem, recopy };
}

// ── SHARED CLIPBOARD LIST UI ────────────────────────────────
// The list-of-items rendering used by both DecisionStrip's clipboard panel and
// LibraryPanel's Clipboard tab, so there is exactly one implementation.
export function ClipboardList({
  items,
  onDelete,
  onRecopy,
  maxHeight = "150px",
}: {
  items: ClipboardEntry[];
  onDelete: (id: string) => void;
  onRecopy: (item: ClipboardEntry) => void;
  maxHeight?: string;
}) {
  return (
    <>
      <style>{`
        .beheld-clip-row .beheld-clip-normal { display: flex; align-items: center; gap: 6px; }
        .beheld-clip-row .beheld-clip-hover { display: none; align-items: center; gap: 4px; }
        .beheld-clip-row:hover { background: #2d4a2d; border-color: #4ADE80; }
        .beheld-clip-row:hover .beheld-clip-normal { display: none; }
        .beheld-clip-row:hover .beheld-clip-hover { display: flex; }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxHeight, overflowY: "auto" }}>
        {items.length === 0 && (
          <div style={{ fontSize: "9px", color: "#5a7a5a", padding: "4px 2px" }}>
            Nothing copied yet.
          </div>
        )}

        {items.map((item) => (
          <div
            key={item.id}
            className="beheld-clip-row"
            style={{ background: "#243b24", border: "1px solid #2d4a2d", borderRadius: "5px", padding: "4px 6px" }}
          >
            <div className="beheld-clip-normal">
              <div
                style={{
                  width: "18px",
                  height: "18px",
                  borderRadius: "4px",
                  background: "#0d1a0d",
                  flex: "0 0 18px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#4ADE80",
                  fontSize: "10px",
                }}
              >
                {item.itemType === "image" ? "🖼" : "📄"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: "#c4e8c4", fontSize: "10px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {item.itemType === "image" ? "Screenshot" : item.content}
                </div>
                <div style={{ color: "#5a7a5a", fontSize: "9px" }}>{formatRelativeTime(item.timestamp)}</div>
              </div>
            </div>

            <div className="beheld-clip-hover">
              <button
                onClick={() => onDelete(item.id)}
                title="Delete"
                style={{ border: "none", background: "transparent", color: "#e2685f", cursor: "pointer", fontSize: "12px", padding: "2px", lineHeight: 1 }}
              >
                🗑
              </button>
              <div style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
                <div style={{ color: "#c4e8c4", fontSize: "10px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {item.itemType === "image" ? "Screenshot" : item.content}
                </div>
              </div>
              <button
                onClick={() => onRecopy(item)}
                title="Copy again"
                style={{ border: "none", background: "transparent", color: "#4ADE80", cursor: "pointer", fontSize: "12px", padding: "2px", lineHeight: 1 }}
              >
                📋
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
