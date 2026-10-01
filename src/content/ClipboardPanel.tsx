import { useEffect, useState } from "react";
import { color, font, radius, space } from "../design/tokens";
import { IconClipboard, IconImage, IconTrash } from "../design/icons";

export interface ClipboardEntry {
  id: string;
  itemType: "text" | "image";
  content: string;
  timestamp: number;
}

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

export function useClipboardItems() {
  const [items, setItems] = useState<ClipboardEntry[]>([]);
  // Only true during the initial fetch — lets the panel show a spinner instead
  // of a misleading "Nothing copied yet" while the request is still in flight.
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Picks up both same-tab updates (e.g. this tab's own copy listener) and
    // cross-tab ones relayed by the service worker's CLIPBOARD_SYNC broadcast,
    // so a panel left open here reflects something copied in a different tab.
    const listener = (updated: ClipboardEntry[]) => setItems(updated);
    clipboardListeners.add(listener);
    return () => {
      clipboardListeners.delete(listener);
    };
  }, []);

  const load = () => {
    setLoading(true);
    chrome.runtime.sendMessage({ type: "GET_CLIPBOARD_ITEMS" }, (response) => {
      setItems(response?.items ?? []);
      setLoading(false);
    });
  };

  const deleteItem = (id: string) => {
    chrome.runtime.sendMessage({ type: "DELETE_CLIPBOARD_ITEM", id }, (response) => {
      setItems(response?.items ?? []);
    });
  };

  const recopy = async (item: ClipboardEntry) => {
    if (item.itemType === "text") await navigator.clipboard.writeText(item.content);
    else await copyImageToClipboard(item.content);
  };

  return { items, loading, load, deleteItem, recopy };
}

export function ClipboardList({
  items,
  onDelete,
  onRecopy,
  maxHeight = "150px",
  loading = false,
}: {
  items: ClipboardEntry[];
  onDelete: (id: string) => void;
  onRecopy: (item: ClipboardEntry) => void;
  maxHeight?: string;
  loading?: boolean;
}) {
  // Only cover the list with the loading state while there's nothing to show yet —
  // once items exist, a background refresh shouldn't blank out what's visible.
  if (loading && items.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: space.sm, padding: `${space.xl}px ${space.sm}px` }}>
        <style>{`
          @keyframes bh-spin { to { transform: rotate(360deg); } }
          .bh-spinner {
            width: 18px;
            height: 18px;
            border-radius: 50%;
            border: 2px solid ${color.border};
            border-top-color: ${color.brand};
            animation: bh-spin 0.7s linear infinite;
          }
          @media (prefers-reduced-motion: reduce) {
            .bh-spinner { animation: none; border-top-color: ${color.border}; }
          }
        `}</style>
        <div className="bh-spinner" aria-hidden="true" />
        <div style={{ color: color.textMuted, fontSize: font.size.sm }}>Loading…</div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div style={{ padding: `${space.xl}px ${space.sm}px`, color: color.textMuted, fontSize: font.size.sm, textAlign: "center" }}>
        Nothing copied yet.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: space.xs, maxHeight, overflowY: "auto", paddingRight: 2 }}>
      {items.map((item) => {
        const label = item.itemType === "image" ? "Screenshot" : item.content;
        return (
          <div
            key={item.id}
            className="bh-row"
            style={{
              display: "flex",
              alignItems: "center",
              gap: space.sm,
              background: color.bgElevated,
              border: `1px solid ${color.border}`,
              borderRadius: radius.sm,
              padding: `${space.sm}px`,
            }}
          >
            <div
              aria-hidden="true"
              style={{
                width: 26,
                height: 26,
                borderRadius: radius.sm,
                background: color.bgBase,
                color: color.brand,
                display: "grid",
                placeItems: "center",
                flex: "0 0 26px",
              }}
            >
              {item.itemType === "image" ? <IconImage size={14} /> : <IconClipboard size={14} />}
            </div>
            <button
              onClick={() => onRecopy(item)}
              title="Copy again"
              style={{
                flex: 1,
                minWidth: 0,
                border: 0,
                background: "transparent",
                padding: 0,
                color: color.textPrimary,
                fontFamily: font.family,
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              <div style={{ fontSize: font.size.sm, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
              <div style={{ marginTop: 2, color: color.textMuted, fontSize: font.size.xs }}>{formatRelativeTime(item.timestamp)}</div>
            </button>
            <button className="bh-icon-btn bh-icon-btn--danger" onClick={() => onDelete(item.id)} title="Delete">
              <IconTrash size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
