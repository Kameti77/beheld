import { useEffect, useState } from "react";
import { ClipboardList, useClipboardItems } from "./ClipboardPanel";

type LibraryTab = "folders" | "clipboard";

interface FolderContentItem {
  filename: string;
  thumbnailDataUrl: string;
}

// ── LIBRARY PANEL ──────────────────────────────────────────
// A persistent browsing UI (Folders + Clipboard tabs) mounted from the popup's
// "Library" button — unlike DecisionStrip's prompt bubble, it never auto-dismisses.
export function LibraryPanel({ folders }: { folders: string[] }) {
  const [closed, setClosed] = useState(false);
  const [tab, setTab] = useState<LibraryTab>("folders");
  const [localFolders, setLocalFolders] = useState<string[]>(folders);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [expandedFolder, setExpandedFolder] = useState<string | null>(null);
  const [folderContents, setFolderContents] = useState<Record<string, FolderContentItem[]>>({});
  const [loadingFolder, setLoadingFolder] = useState<string | null>(null);
  const [confirmingDeleteFolder, setConfirmingDeleteFolder] = useState<string | null>(null);

  const clipboard = useClipboardItems();

  useEffect(() => {
    chrome.runtime.sendMessage({ type: "GET_FOLDER_SUMMARY" }, (response) => {
      setCounts(response?.counts ?? {});
    });
  }, []);

  useEffect(() => {
    if (tab === "clipboard") clipboard.load();
  }, [tab]);

  if (closed) return null;

  const regularFolders = localFolders.filter((f) => f !== "Temp");
  const hasTemp = localFolders.includes("Temp");

  const handleDeleteFolder = (name: string) => {
    chrome.runtime.sendMessage({ type: "DELETE_FOLDER", folderName: name }, (response) => {
      if (response?.success) {
        setLocalFolders((prev) => prev.filter((f) => f !== name));
        setCounts((prev) => {
          const next = { ...prev };
          delete next[name];
          return next;
        });
        setFolderContents((prev) => {
          const next = { ...prev };
          delete next[name];
          return next;
        });
        setExpandedFolder((prev) => (prev === name ? null : prev));
      } else {
        console.error(`BeHeld: failed to delete folder ${name}`);
      }
      setConfirmingDeleteFolder(null);
    });
  };

  const handleToggleFolder = (name: string) => {
    if (expandedFolder === name) {
      setExpandedFolder(null);
      return;
    }
    setExpandedFolder(name);
    if (folderContents[name]) return;
    setLoadingFolder(name);
    chrome.runtime.sendMessage({ type: "GET_FOLDER_CONTENTS", folderName: name }, (response) => {
      setFolderContents((prev) => ({ ...prev, [name]: response?.items ?? [] }));
      setLoadingFolder(null);
    });
  };

  const handleDeleteScreenshot = (folder: string, filename: string) => {
    chrome.runtime.sendMessage(
      { type: "DELETE_SCREENSHOT", folderName: folder, filename },
      (response) => {
        if (response?.success) {
          setFolderContents((prev) => ({
            ...prev,
            [folder]: (prev[folder] ?? []).filter((item) => item.filename !== filename),
          }));
          setCounts((prev) => ({ ...prev, [folder]: Math.max(0, (prev[folder] ?? 1) - 1) }));
        } else {
          console.error(`BeHeld: failed to delete screenshot ${filename}`);
        }
      }
    );
  };

  const renderFolderRow = (folder: string) => (
    <div key={folder} style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        {confirmingDeleteFolder === folder ? (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%" }}>
            <span style={{ flex: 1, fontSize: "12px", color: "#c4e8c4" }}>Delete "{folder}"?</span>
            <button
              onClick={() => handleDeleteFolder(folder)}
              style={{ border: "none", background: "transparent", color: "#e2685f", cursor: "pointer", fontSize: "12px" }}
            >
              Yes
            </button>
            <button
              onClick={() => setConfirmingDeleteFolder(null)}
              style={{ border: "none", background: "transparent", color: "#5a7a5a", cursor: "pointer", fontSize: "12px" }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={() => handleToggleFolder(folder)}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: folder === "Temp" ? "#2a2008" : "#2d4a2d",
                border: folder === "Temp" ? "1px solid #6a4e0a" : "1px solid #3a5e3a",
                borderRadius: "8px",
                padding: "10px 12px",
                color: folder === "Temp" ? "#F59E0B" : "#c4e8c4",
                fontSize: "13px",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span>{expandedFolder === folder ? "📂" : "📁"} {folder}</span>
              <span style={{ fontSize: "11px", opacity: 0.75 }}>{counts[folder] ?? "…"}</span>
            </button>
            <button
              onClick={() => setConfirmingDeleteFolder(folder)}
              title={`Delete ${folder}`}
              style={{ border: "none", background: "transparent", color: "#5a7a5a", cursor: "pointer", fontSize: "13px", padding: "4px" }}
            >
              🗑
            </button>
          </>
        )}
      </div>

      {expandedFolder === folder && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", padding: "10px 4px 4px 4px" }}>
          {loadingFolder === folder && (
            <div style={{ fontSize: "11px", color: "#5a7a5a" }}>Loading…</div>
          )}
          {loadingFolder !== folder && (folderContents[folder]?.length ?? 0) === 0 && (
            <div style={{ fontSize: "11px", color: "#5a7a5a" }}>No screenshots yet.</div>
          )}
          {loadingFolder !== folder &&
            (folderContents[folder] ?? []).map((item) => (
              <div
                key={item.filename}
                className="beheld-lib-thumb"
                style={{ position: "relative", width: "72px", height: "72px" }}
              >
                <img
                  src={item.thumbnailDataUrl}
                  alt={item.filename}
                  style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "6px", border: "1px solid #2d4a2d" }}
                />
                <button
                  onClick={() => handleDeleteScreenshot(folder, item.filename)}
                  title="Delete"
                  className="beheld-lib-thumb-delete"
                  style={{
                    position: "absolute",
                    top: "2px",
                    right: "2px",
                    border: "none",
                    background: "rgba(26, 46, 26, 0.85)",
                    color: "#e2685f",
                    borderRadius: "4px",
                    fontSize: "11px",
                    cursor: "pointer",
                    padding: "2px 4px",
                    lineHeight: 1,
                  }}
                >
                  🗑
                </button>
              </div>
            ))}
        </div>
      )}
    </div>
  );

  return (
    <div
      style={{
        position: "fixed",
        top: "60px",
        right: "20px",
        width: "360px",
        maxHeight: "80vh",
        background: "#1A2E1A",
        border: "1px solid #2d4a2d",
        borderRadius: "12px",
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4)",
        zIndex: 999999,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily: "sans-serif",
      }}
    >
      <style>{`
        .beheld-lib-thumb-delete { opacity: 0; transition: opacity 0.15s ease; }
        .beheld-lib-thumb:hover .beheld-lib-thumb-delete { opacity: 1; }
      `}</style>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 14px",
          borderBottom: "1px solid #2d4a2d",
        }}
      >
        <div style={{ display: "flex", gap: "6px" }}>
          <button
            onClick={() => setTab("folders")}
            style={{
              background: tab === "folders" ? "#2d4a2d" : "transparent",
              border: `1px solid ${tab === "folders" ? "#4ADE80" : "#3a5e3a"}`,
              borderRadius: "6px",
              padding: "6px 12px",
              color: tab === "folders" ? "#4ADE80" : "#c4e8c4",
              fontSize: "12px",
              cursor: "pointer",
            }}
          >
            Folders
          </button>
          <button
            onClick={() => setTab("clipboard")}
            style={{
              background: tab === "clipboard" ? "#2d4a2d" : "transparent",
              border: `1px solid ${tab === "clipboard" ? "#4ADE80" : "#3a5e3a"}`,
              borderRadius: "6px",
              padding: "6px 12px",
              color: tab === "clipboard" ? "#4ADE80" : "#c4e8c4",
              fontSize: "12px",
              cursor: "pointer",
            }}
          >
            Clipboard
          </button>
        </div>
        <button
          onClick={() => setClosed(true)}
          title="Close"
          style={{ border: "none", background: "transparent", color: "#5a7a5a", cursor: "pointer", fontSize: "14px", lineHeight: 1 }}
        >
          ✕
        </button>
      </div>

      <div style={{ padding: "12px 14px", overflowY: "auto" }}>
        {tab === "folders" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ fontSize: "11px", color: "#5a7a5a", lineHeight: 1.4 }}>
              Open your screenshots folder in File Explorer or Finder to view the saved files directly.
            </div>
            {regularFolders.map(renderFolderRow)}
            {hasTemp && renderFolderRow("Temp")}
          </div>
        ) : (
          <ClipboardList items={clipboard.items} onDelete={clipboard.deleteItem} onRecopy={clipboard.recopy} maxHeight="60vh" />
        )}
      </div>
    </div>
  );
}
