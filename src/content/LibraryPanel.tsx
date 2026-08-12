import { useEffect, useState } from "react";
import { ClipboardList, useClipboardItems } from "./ClipboardPanel";

type LibraryTab = "folders" | "clipboard";

interface FolderContentItem {
  filename: string;
  thumbnailDataUrl: string;
}

interface FolderContentsState {
  items: FolderContentItem[];
  hasOlder: boolean;
  permissionDenied: boolean;
}

interface LightboxState {
  folder: string;
  filename: string;
  loading: boolean;
  error: boolean;
  dataUrl: string | null;
}

function FolderThumbnail({
  item,
  isConfirming,
  onDeleteClick,
  onConfirmDelete,
  onCancelDelete,
  onImageClick,
}: {
  item: FolderContentItem;
  isConfirming: boolean;
  onDeleteClick: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onImageClick: () => void;
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: "72px" }}>
      <div className="beheld-lib-thumb" style={{ position: "relative", width: "72px", height: "72px" }}>
        <img
          src={item.thumbnailDataUrl}
          alt={item.filename}
          onLoad={() => setLoaded(true)}
          onClick={() => {
            if (!isConfirming) onImageClick();
          }}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            borderRadius: "6px",
            border: "1px solid #2d4a2d",
            opacity: loaded ? 1 : 0,
            transition: "opacity 0.3s ease",
            cursor: isConfirming ? "default" : "pointer",
          }}
        />
        {!isConfirming && (
          <button
            onClick={onDeleteClick}
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
        )}
      </div>
      {isConfirming && (
        <div style={{ fontSize: "10px", color: "#c4e8c4", textAlign: "center", lineHeight: 1.3 }}>
          Delete this screenshot?
          <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginTop: "2px" }}>
            <button
              onClick={onConfirmDelete}
              style={{ border: "none", background: "transparent", color: "#e2685f", cursor: "pointer", fontSize: "11px" }}
            >
              Yes
            </button>
            <button
              onClick={onCancelDelete}
              style={{ border: "none", background: "transparent", color: "#5a7a5a", cursor: "pointer", fontSize: "11px" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── LIBRARY PANEL ──────────────────────────────────────────
// A persistent browsing UI mounted from the popup's "Library" button. Unlike
// DecisionStrip's prompt bubble it never auto-dismisses, and — mirroring
// DecisionStrip's own icon column — it collapses by default to a thin icon
// strip, expanding at most one of its two views (Folders / Clipboard) at a time.
export function LibraryPanel({ folders }: { folders: string[] }) {
  const [closed, setClosed] = useState(false);
  const [expandedView, setExpandedView] = useState<LibraryTab | null>(null);
  const [localFolders, setLocalFolders] = useState<string[]>(folders);
  const [expandedFolder, setExpandedFolder] = useState<string | null>(null);
  const [folderContents, setFolderContents] = useState<Record<string, FolderContentsState>>({});
  const [loadingFolder, setLoadingFolder] = useState<string | null>(null);
  const [confirmingDeleteFolder, setConfirmingDeleteFolder] = useState<string | null>(null);
  const [confirmingDeleteScreenshot, setConfirmingDeleteScreenshot] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);

  const clipboard = useClipboardItems();

  useEffect(() => {
    if (expandedView === "clipboard") clipboard.load();
  }, [expandedView]);

  if (closed) return null;

  const regularFolders = localFolders.filter((f) => f !== "Temp");
  const hasTemp = localFolders.includes("Temp");

  const handleDeleteFolder = (name: string) => {
    chrome.runtime.sendMessage({ type: "DELETE_FOLDER", folderName: name }, (response) => {
      if (response?.success) {
        setLocalFolders((prev) => prev.filter((f) => f !== name));
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

  const loadFolderContents = (name: string, includeOlder: boolean) => {
    setLoadingFolder(name);
    chrome.runtime.sendMessage(
      { type: "GET_FOLDER_CONTENTS", folderName: name, includeOlder },
      (response) => {
        setFolderContents((prev) => ({
          ...prev,
          [name]: {
            items: response?.items ?? [],
            hasOlder: response?.hasOlder ?? false,
            permissionDenied: response?.permissionDenied ?? false,
          },
        }));
        setLoadingFolder(null);
      }
    );
  };

  const handleToggleFolder = (name: string) => {
    if (expandedFolder === name) {
      setExpandedFolder(null);
      return;
    }
    setExpandedFolder(name);
    if (folderContents[name]) return;
    loadFolderContents(name, false);
  };

  const handleShowOlder = (name: string) => {
    loadFolderContents(name, true);
  };

  const handleDeleteScreenshot = (folder: string, filename: string) => {
    chrome.runtime.sendMessage(
      { type: "DELETE_SCREENSHOT", folderName: folder, filename },
      (response) => {
        if (response?.success) {
          setFolderContents((prev) => {
            const current = prev[folder];
            if (!current) return prev;
            return {
              ...prev,
              [folder]: {
                ...current,
                items: current.items.filter((item) => item.filename !== filename),
              },
            };
          });
        } else {
          console.error(`BeHeld: failed to delete screenshot ${filename}`);
        }
        setConfirmingDeleteScreenshot(null);
      }
    );
  };

  const openLightbox = (folder: string, filename: string) => {
    setLightbox({ folder, filename, loading: true, error: false, dataUrl: null });
    chrome.runtime.sendMessage(
      { type: "GET_SCREENSHOT", folderName: folder, filename },
      (response) => {
        setLightbox((prev) => {
          if (!prev || prev.folder !== folder || prev.filename !== filename) return prev;
          if (response?.success && response?.dataUrl) {
            return { ...prev, loading: false, error: false, dataUrl: response.dataUrl };
          }
          return { ...prev, loading: false, error: true };
        });
      }
    );
  };

  const closeLightbox = () => setLightbox(null);

  const handleToggleView = (view: LibraryTab) => {
    setExpandedView((prev) => (prev === view ? null : view));
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
        <div style={{ padding: "10px 4px 4px 4px" }}>
          {loadingFolder === folder && (
            <div style={{ fontSize: "11px", color: "#5a7a5a" }}>Loading…</div>
          )}
          {loadingFolder !== folder && folderContents[folder]?.permissionDenied && (
            <div style={{ fontSize: "11px", color: "#F59E0B" }}>
              Permission needed — open the popup and re-select your screenshots folder.
            </div>
          )}
          {loadingFolder !== folder &&
            !folderContents[folder]?.permissionDenied &&
            (folderContents[folder]?.items.length ?? 0) === 0 && (
              <div>
                <div style={{ fontSize: "11px", color: "#5a7a5a" }}>No recent screenshots in this folder</div>
                {folderContents[folder]?.hasOlder && (
                  <button
                    onClick={() => handleShowOlder(folder)}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "#4ADE80",
                      cursor: "pointer",
                      fontSize: "11px",
                      padding: 0,
                      marginTop: "6px",
                      textDecoration: "underline",
                    }}
                  >
                    Show older
                  </button>
                )}
              </div>
            )}
          {loadingFolder !== folder &&
            !folderContents[folder]?.permissionDenied &&
            (folderContents[folder]?.items.length ?? 0) > 0 && (
              <div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {(folderContents[folder]?.items ?? []).map((item) => {
                    const key = `${folder}|${item.filename}`;
                    return (
                      <FolderThumbnail
                        key={item.filename}
                        item={item}
                        isConfirming={confirmingDeleteScreenshot === key}
                        onDeleteClick={() => setConfirmingDeleteScreenshot(key)}
                        onConfirmDelete={() => handleDeleteScreenshot(folder, item.filename)}
                        onCancelDelete={() => setConfirmingDeleteScreenshot(null)}
                        onImageClick={() => openLightbox(folder, item.filename)}
                      />
                    );
                  })}
                </div>
                {folderContents[folder]?.hasOlder && (
                  <button
                    onClick={() => handleShowOlder(folder)}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "#4ADE80",
                      cursor: "pointer",
                      fontSize: "11px",
                      padding: 0,
                      marginTop: "8px",
                      textDecoration: "underline",
                    }}
                  >
                    Show older
                  </button>
                )}
              </div>
            )}
        </div>
      )}
    </div>
  );

  // Mirrors DecisionStrip's icon column: rounded on whichever edges aren't
  // flush against an expanded view, flat on the seam shared with it.
  let iconColumnRadius = "8px";
  if (expandedView === "folders") iconColumnRadius = "0 8px 8px 0";
  if (expandedView === "clipboard") iconColumnRadius = "8px 8px 0 0";

  return (
    <>
    <div
      style={{
        position: "fixed",
        top: "60px",
        right: "20px",
        zIndex: 999999,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        fontFamily: "sans-serif",
      }}
    >
      <style>{`
        .beheld-lib-thumb-delete { opacity: 0; transition: opacity 0.15s ease; }
        .beheld-lib-thumb:hover .beheld-lib-thumb-delete { opacity: 1; }
      `}</style>

      {/* Folders view expands to the left of the icon column, matching
          DecisionStrip's own folder-panel-to-the-left convention. */}
      <div style={{ display: "flex", alignItems: "flex-start" }}>
        {expandedView === "folders" && (
          <div
            style={{
              background: "#1f361f",
              border: "1px solid #2d4a2d",
              borderRadius: "8px 0 0 8px",
              padding: "12px 14px",
              width: "320px",
              maxHeight: "70vh",
              overflowY: "auto",
              boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4)",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ fontSize: "11px", color: "#5a7a5a", lineHeight: 1.4 }}>
                Folders show screenshots from the last 7 days only. Open your screenshots folder in File Explorer or Finder to view older or all saved files directly.
              </div>
              {regularFolders.map(renderFolderRow)}
              {hasTemp && renderFolderRow("Temp")}
            </div>
          </div>
        )}

        <div
          style={{
            background: "#1A2E1A",
            borderRadius: iconColumnRadius,
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4)",
            width: "36px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "10px 0",
            gap: "12px",
          }}
        >
          <div
            onClick={() => handleToggleView("folders")}
            title="Folders"
            style={{
              color: "#4ADE80",
              fontSize: "18px",
              cursor: "pointer",
              lineHeight: 1,
              background: expandedView === "folders" ? "#243b24" : "transparent",
              borderRadius: "4px",
              padding: "2px",
            }}
          >
            📁
          </div>

          <div
            onClick={() => handleToggleView("clipboard")}
            title="Clipboard"
            style={{
              color: "#4ADE80",
              fontSize: "18px",
              cursor: "pointer",
              lineHeight: 1,
              background: expandedView === "clipboard" ? "#243b24" : "transparent",
              borderRadius: "4px",
              padding: "2px",
            }}
          >
            📑
          </div>

          <button
            onClick={() => setClosed(true)}
            title="Close"
            style={{ border: "none", background: "transparent", color: "#5a7a5a", cursor: "pointer", fontSize: "14px", lineHeight: 1 }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Clipboard view expands below the icon column, matching DecisionStrip's
          own clipboard-panel-below convention. */}
      {expandedView === "clipboard" && (
        <div
          style={{
            width: "320px",
            background: "#1f361f",
            border: "1px solid #2d4a2d",
            borderRadius: "0 0 8px 8px",
            padding: "10px",
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4)",
          }}
        >
          <ClipboardList items={clipboard.items} onDelete={clipboard.deleteItem} onRecopy={clipboard.recopy} maxHeight="60vh" />
        </div>
      )}
    </div>

    {lightbox && (
      <div
        onClick={closeLightbox}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          background: "rgba(0, 0, 0, 0.75)",
          zIndex: 1000000,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "relative",
            maxWidth: "85vw",
            maxHeight: "85vh",
            background: "#1A2E1A",
            border: "1px solid #2d4a2d",
            borderRadius: "10px",
            padding: "16px",
            boxShadow: "0 12px 32px rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <button
            onClick={closeLightbox}
            title="Close"
            style={{
              position: "absolute",
              top: "8px",
              right: "8px",
              border: "none",
              background: "rgba(26, 46, 26, 0.85)",
              color: "#c4e8c4",
              borderRadius: "4px",
              fontSize: "14px",
              cursor: "pointer",
              padding: "4px 8px",
              lineHeight: 1,
            }}
          >
            ✕
          </button>
          {lightbox.loading && (
            <div style={{ color: "#c4e8c4", fontSize: "13px", padding: "48px 64px" }}>
              Loading full image…
            </div>
          )}
          {!lightbox.loading && lightbox.error && (
            <div style={{ color: "#e2685f", fontSize: "13px", padding: "48px 64px" }}>
              Failed to load full-resolution image.
            </div>
          )}
          {!lightbox.loading && !lightbox.error && lightbox.dataUrl && (
            <img
              src={lightbox.dataUrl}
              alt={lightbox.filename}
              style={{
                maxWidth: "85vw",
                maxHeight: "85vh",
                objectFit: "contain",
                borderRadius: "6px",
                display: "block",
              }}
            />
          )}
        </div>
      </div>
    )}
    </>
  );
}
