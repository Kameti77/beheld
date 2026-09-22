import { useEffect, useState } from "react";
import { Button } from "../design/Button";
import { color, font, radius, shadow, space } from "../design/tokens";
import {
  IconChevronDown,
  IconChevronRight,
  IconClipboard,
  IconClose,
  IconFolder,
  IconFolderOpen,
  IconTrash,
} from "../design/icons";
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
    <div style={{ width: 84 }}>
      <div className="bh-thumbnail" style={{ position: "relative", width: 84, height: 72 }}>
        <img
          src={item.thumbnailDataUrl}
          alt={item.filename}
          onLoad={() => setLoaded(true)}
          onClick={() => !isConfirming && onImageClick()}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            borderRadius: radius.sm,
            border: `1px solid ${color.border}`,
            opacity: loaded ? 1 : 0,
            transition: "opacity 180ms ease",
            cursor: isConfirming ? "default" : "zoom-in",
          }}
        />
        {!isConfirming && (
          <button
            className="bh-icon-btn bh-icon-btn--danger bh-thumbnail-delete"
            onClick={onDeleteClick}
            title={`Delete ${item.filename}`}
            style={{ position: "absolute", top: 4, right: 4, background: color.bgElevated }}
          >
            <IconTrash size={13} />
          </button>
        )}
      </div>
      {isConfirming && (
        <div style={{ marginTop: space.xs, color: color.textSecondary, fontSize: font.size.xs, lineHeight: 1.35, textAlign: "center" }}>
          Delete this?
          <div style={{ display: "flex", justifyContent: "center", gap: space.sm, marginTop: 2 }}>
            <button className="bh-link-button" onClick={onConfirmDelete} style={{ color: color.error }}>Delete</button>
            <button className="bh-link-button" onClick={onCancelDelete} style={{ color: color.textMuted }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

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

  const regularFolders = localFolders.filter((folder) => folder !== "Temp");
  const hasTemp = localFolders.includes("Temp");

  const loadFolderContents = (name: string, includeOlder: boolean) => {
    setLoadingFolder(name);
    chrome.runtime.sendMessage({ type: "GET_FOLDER_CONTENTS", folderName: name, includeOlder }, (response) => {
      setFolderContents((previous) => ({
        ...previous,
        [name]: {
          items: response?.items ?? [],
          hasOlder: response?.hasOlder ?? false,
          permissionDenied: response?.permissionDenied ?? false,
        },
      }));
      setLoadingFolder(null);
    });
  };

  const handleToggleFolder = (name: string) => {
    if (expandedFolder === name) return setExpandedFolder(null);
    setExpandedFolder(name);
    if (!folderContents[name]) loadFolderContents(name, false);
  };

  const handleDeleteFolder = (name: string) => {
    chrome.runtime.sendMessage({ type: "DELETE_FOLDER", folderName: name }, (response) => {
      if (response?.success) {
        setLocalFolders((previous) => previous.filter((folder) => folder !== name));
        setFolderContents((previous) => {
          const next = { ...previous };
          delete next[name];
          return next;
        });
        setExpandedFolder((previous) => (previous === name ? null : previous));
      } else {
        console.error(`BeHeld: failed to delete folder ${name}`);
      }
      setConfirmingDeleteFolder(null);
    });
  };

  const handleDeleteScreenshot = (folder: string, filename: string) => {
    chrome.runtime.sendMessage({ type: "DELETE_SCREENSHOT", folderName: folder, filename }, (response) => {
      if (response?.success) {
        setFolderContents((previous) => {
          const current = previous[folder];
          if (!current) return previous;
          return { ...previous, [folder]: { ...current, items: current.items.filter((item) => item.filename !== filename) } };
        });
      } else {
        console.error(`BeHeld: failed to delete screenshot ${filename}`);
      }
      setConfirmingDeleteScreenshot(null);
    });
  };

  const openLightbox = (folder: string, filename: string) => {
    setLightbox({ folder, filename, loading: true, error: false, dataUrl: null });
    chrome.runtime.sendMessage({ type: "GET_SCREENSHOT", folderName: folder, filename }, (response) => {
      setLightbox((previous) => {
        if (!previous || previous.folder !== folder || previous.filename !== filename) return previous;
        if (response?.success && response?.dataUrl) return { ...previous, loading: false, dataUrl: response.dataUrl };
        return { ...previous, loading: false, error: true };
      });
    });
  };

  const renderFolderRow = (folder: string) => {
    const isTemp = folder === "Temp";
    const isOpen = expandedFolder === folder;
    const contents = folderContents[folder];

    return (
      <div key={folder} style={{ display: "flex", flexDirection: "column", gap: space.sm }}>
        {confirmingDeleteFolder === folder ? (
          <div style={{ display: "flex", alignItems: "center", gap: space.sm, padding: `${space.sm}px` }}>
            <span style={{ flex: 1, color: color.textSecondary, fontSize: font.size.sm }}>Delete “{folder}” and its screenshots?</span>
            <Button variant="destructive" size="sm" onClick={() => handleDeleteFolder(folder)}>Delete</Button>
            <Button variant="tertiary" size="sm" onClick={() => setConfirmingDeleteFolder(null)}>Cancel</Button>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: space.xs }}>
            <button
              className="bh-row"
              onClick={() => handleToggleFolder(folder)}
              aria-expanded={isOpen}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                gap: space.sm,
                background: color.bgElevated,
                border: `1px solid ${isOpen ? color.borderStrong : color.border}`,
                borderRadius: radius.md,
                padding: `${space.sm}px ${space.md}px`,
                color: color.textPrimary,
                fontFamily: font.family,
                fontSize: font.size.base,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              {isOpen ? <IconFolderOpen size={15} color={isTemp ? color.warning : color.brand} /> : <IconFolder size={15} color={isTemp ? color.warning : color.brand} />}
              <span style={{ flex: 1 }}>{folder}</span>
              {isOpen ? <IconChevronDown size={15} color={color.textMuted} /> : <IconChevronRight size={15} color={color.textMuted} />}
            </button>
            <button className="bh-icon-btn bh-icon-btn--danger" onClick={() => setConfirmingDeleteFolder(folder)} title={`Delete ${folder}`}>
              <IconTrash size={14} />
            </button>
          </div>
        )}

        {isOpen && (
          <div style={{ padding: `0 ${space.xs}px ${space.md}px` }}>
            {loadingFolder === folder && <div style={{ color: color.textMuted, fontSize: font.size.sm }}>Loading screenshots…</div>}
            {loadingFolder !== folder && contents?.permissionDenied && (
              <div style={{ color: color.warningText, fontSize: font.size.sm, lineHeight: 1.45 }}>
                Permission needed — open the popup and re-select your screenshots folder.
              </div>
            )}
            {loadingFolder !== folder && !contents?.permissionDenied && (contents?.items.length ?? 0) === 0 && (
              <div style={{ color: color.textMuted, fontSize: font.size.sm }}>
                No recent screenshots in this folder.
                {contents?.hasOlder && <div style={{ marginTop: space.sm }}><button className="bh-link-button" onClick={() => loadFolderContents(folder, true)}>Show older</button></div>}
              </div>
            )}
            {loadingFolder !== folder && !contents?.permissionDenied && (contents?.items.length ?? 0) > 0 && (
              <div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: space.sm }}>
                  {contents?.items.map((item) => {
                    const key = `${folder}|${item.filename}`;
                    return <FolderThumbnail key={item.filename} item={item} isConfirming={confirmingDeleteScreenshot === key} onDeleteClick={() => setConfirmingDeleteScreenshot(key)} onConfirmDelete={() => handleDeleteScreenshot(folder, item.filename)} onCancelDelete={() => setConfirmingDeleteScreenshot(null)} onImageClick={() => openLightbox(folder, item.filename)} />;
                  })}
                </div>
                {contents?.hasOlder && <div style={{ marginTop: space.md }}><button className="bh-link-button" onClick={() => loadFolderContents(folder, true)}>Show older</button></div>}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const iconColumnRadius = expandedView === "folders" ? `0 ${radius.lg}px ${radius.lg}px 0` : expandedView === "clipboard" ? `${radius.lg}px ${radius.lg}px 0 0` : `${radius.lg}px`;

  return (
    <>
      <div style={{ position: "fixed", top: 60, right: 20, zIndex: 999999, display: "flex", flexDirection: "column", alignItems: "flex-end", fontFamily: font.family }}>
        <div style={{ display: "flex", alignItems: "flex-start" }}>
          {expandedView === "folders" && (
            <section style={{ width: 336, maxHeight: "70vh", overflowY: "auto", background: color.bgSurface, borderRadius: `${radius.lg}px 0 0 ${radius.lg}px`, boxShadow: shadow.lg, padding: space.lg }}>
              <div style={{ marginBottom: space.lg }}>
                <h2 style={{ margin: 0, color: color.textPrimary, fontSize: font.size.md, fontWeight: font.weight.semibold }}>Screenshot folders</h2>
                <p style={{ margin: `${space.xs}px 0 0`, color: color.textMuted, fontSize: font.size.xs, lineHeight: 1.45 }}>Showing the last 7 days. Older screenshots remain available in your saved folder.</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: space.sm }}>
                {regularFolders.map(renderFolderRow)}
                {hasTemp && renderFolderRow("Temp")}
              </div>
            </section>
          )}

          <nav aria-label="BeHeld library" style={{ background: color.bgElevated, borderRadius: iconColumnRadius, boxShadow: shadow.lg, width: 40, display: "flex", flexDirection: "column", alignItems: "center", padding: `${space.sm}px 0`, gap: space.sm }}>
            <button className="bh-icon-btn" onClick={() => setExpandedView((current) => current === "folders" ? null : "folders")} title="Folders" aria-label="Folders" style={{ color: expandedView === "folders" ? color.brand : color.textSecondary, background: expandedView === "folders" ? color.bgHover : "transparent" }}>
              <IconFolder size={17} />
            </button>
            <button className="bh-icon-btn" onClick={() => setExpandedView((current) => current === "clipboard" ? null : "clipboard")} title="Clipboard" aria-label="Clipboard" style={{ color: expandedView === "clipboard" ? color.brand : color.textSecondary, background: expandedView === "clipboard" ? color.bgHover : "transparent" }}>
              <IconClipboard size={17} />
            </button>
            <div style={{ height: 1, width: 20, background: color.border, margin: `${space.xs}px 0` }} />
            <button className="bh-icon-btn" onClick={() => setClosed(true)} title="Close library" aria-label="Close library"><IconClose size={16} /></button>
          </nav>
        </div>

        {expandedView === "clipboard" && (
          <section style={{ width: 336, background: color.bgSurface, borderRadius: `0 0 ${radius.lg}px ${radius.lg}px`, boxShadow: shadow.lg, padding: space.lg }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: space.md }}>
              <h2 style={{ margin: 0, color: color.textPrimary, fontSize: font.size.md, fontWeight: font.weight.semibold }}>Clipboard</h2>
              <span style={{ color: color.textMuted, fontSize: font.size.xs }}>{clipboard.items.length} item{clipboard.items.length === 1 ? "" : "s"}</span>
            </div>
            <ClipboardList items={clipboard.items} onDelete={clipboard.deleteItem} onRecopy={clipboard.recopy} maxHeight="60vh" />
          </section>
        )}
      </div>

      {lightbox && (
        <div onClick={() => setLightbox(null)} role="presentation" style={{ position: "fixed", inset: 0, background: "rgba(8, 11, 9, 0.78)", zIndex: 1000000, display: "flex", alignItems: "center", justifyContent: "center", padding: space.xxl }}>
          <div onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label={lightbox.filename} style={{ position: "relative", maxWidth: "85vw", maxHeight: "85vh", background: color.bgSurface, border: `1px solid ${color.border}`, borderRadius: radius.lg, padding: space.lg, boxShadow: shadow.lg, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <button className="bh-icon-btn" onClick={() => setLightbox(null)} title="Close" aria-label="Close" style={{ position: "absolute", top: space.sm, right: space.sm, background: color.bgElevated, zIndex: 1 }}><IconClose size={16} /></button>
            {lightbox.loading && <div style={{ color: color.textSecondary, fontSize: font.size.base, padding: "48px 64px" }}>Loading full image…</div>}
            {!lightbox.loading && lightbox.error && <div style={{ color: color.error, fontSize: font.size.base, padding: "48px 64px" }}>Failed to load full-resolution image.</div>}
            {!lightbox.loading && !lightbox.error && lightbox.dataUrl && <img src={lightbox.dataUrl} alt={lightbox.filename} style={{ maxWidth: "85vw", maxHeight: "85vh", objectFit: "contain", borderRadius: radius.sm, display: "block" }} />}
          </div>
        </div>
      )}
    </>
  );
}
