import { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  notifyClipboardListeners,
  copyImageToClipboard,
  useClipboardItems,
  ClipboardList,
} from "./ClipboardPanel";
import { LibraryPanel } from "./LibraryPanel";

// ── TYPES ──────────────────────────────────────────────────
type StripState = "prompt" | "folders" | "dismissed";

interface Confirmation {
  kind: "success" | "error";
  message: string;
}

// ── SITE-WIDE COPY CAPTURE ─────────────────────────────────
// Runs once per page load, independent of whether the strip is mounted,
// so nothing copied gets lost even if no screenshot has been taken recently.
let lastCapturedText = "";

document.addEventListener("copy", () => {
  const text = document.getSelection()?.toString().trim();
  if (!text || text === lastCapturedText) return;
  lastCapturedText = text;
  chrome.runtime.sendMessage(
    { type: "ADD_CLIPBOARD_ITEM", itemType: "text", content: text },
    (response) => {
      if (response?.items) notifyClipboardListeners(response.items);
    }
  );
});

// ── SCREENSHOT CROPPING ─────────────────────────────────────
function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

// The selection rectangle is drawn in CSS/viewport pixels, but the captured
// screenshot's natural pixel dimensions can differ (devicePixelRatio, page zoom),
// so the selection must be scaled into the image's own pixel space before drawing.
async function cropImageDataUrl(
  dataUrl: string,
  x: number,
  y: number,
  w: number,
  h: number
): Promise<string> {
  const img = await loadImage(dataUrl);
  const scaleX = img.naturalWidth / window.innerWidth;
  const scaleY = img.naturalHeight / window.innerHeight;

  const sx = x * scaleX;
  const sy = y * scaleY;
  const sw = w * scaleX;
  const sh = h * scaleY;

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sw));
  canvas.height = Math.max(1, Math.round(sh));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("BeHeld: canvas context unavailable for crop");
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

// ── BROWSE FOR FOLDER (OS PICKER) ───────────────────────────
// Writes directly through the freshly-picked handle rather than relaying it to the
// service worker/offscreen document: a FileSystemDirectoryHandle obtained here is tied
// to this content script's relevant-settings-object origin (the host page's origin),
// per the WHATWG File System spec's handle serialization steps, which record the
// origin at serialize-time and require an exact match at deserialize-time. That origin
// can never match chrome-extension://<id>, so sending this handle across any
// chrome.runtime message (or any other postMessage-based transfer) to the service
// worker or offscreen document would throw DataCloneError. The write must therefore
// happen right here, in the same live realm the handle was picked in.
async function saveDataUrlToDirectory(
  dirHandle: FileSystemDirectoryHandle,
  dataUrl: string
): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `screenshot-${timestamp}.png`;

  const res = await fetch(dataUrl);
  const blob = await res.blob();

  const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
}

type CropCorner = "nw" | "ne" | "sw" | "se";
type CropDragMode = "none" | "drawing" | "moving" | "resizing";

// Tracks the currently-open crop overlay's teardown function (if any), so a new
// capture arriving while the overlay is still open can force it closed instead of
// leaving it orphaned on top of the freshly-mounted strip — see closeCropOverlayIfOpen().
let closeActiveCropOverlay: (() => void) | null = null;

// Vanilla-DOM crop overlay: mounted straight into document.body (mirrors the
// remove-before-create pattern used by #beheld-strip-root / #beheld-flash-overlay),
// independent of React so its own drag tracking can't step on the strip's state.
function openCropOverlay(
  imageDataUrl: string,
  onConfirm: (croppedDataUrl: string) => void,
  onCancel: () => void
) {
  const existingRoot = document.getElementById("beheld-crop-root");
  if (existingRoot) existingRoot.remove();

  const root = document.createElement("div");
  root.id = "beheld-crop-root";
  document.body.appendChild(root);

  const overlay = document.createElement("div");
  Object.assign(overlay.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "100vw",
    height: "100vh",
    background: "rgba(0, 0, 0, 0.5)",
    zIndex: "2147483000",
    cursor: "crosshair",
    pointerEvents: "auto",
  });
  root.appendChild(overlay);

  const rectEl = document.createElement("div");
  Object.assign(rectEl.style, {
    position: "absolute",
    border: "2px solid #4ADE80",
    background: "rgba(74, 222, 128, 0.08)",
    boxSizing: "border-box",
    display: "none",
    cursor: "move",
  });
  overlay.appendChild(rectEl);

  const tooltip = document.createElement("div");
  Object.assign(tooltip.style, {
    position: "absolute",
    background: "#1A2E1A",
    color: "#4ADE80",
    fontSize: "11px",
    fontFamily: "sans-serif",
    padding: "3px 6px",
    borderRadius: "4px",
    pointerEvents: "none",
    whiteSpace: "nowrap",
    display: "none",
  });
  overlay.appendChild(tooltip);

  const HANDLE_SIZE = 10;
  const corners: CropCorner[] = ["nw", "ne", "sw", "se"];
  const handles: Record<CropCorner, HTMLDivElement> = {} as Record<CropCorner, HTMLDivElement>;
  corners.forEach((corner) => {
    const handle = document.createElement("div");
    Object.assign(handle.style, {
      position: "absolute",
      width: `${HANDLE_SIZE}px`,
      height: `${HANDLE_SIZE}px`,
      background: "#4ADE80",
      border: "1px solid #1A2E1A",
      borderRadius: "2px",
      display: "none",
      cursor: corner === "nw" || corner === "se" ? "nwse-resize" : "nesw-resize",
    });
    overlay.appendChild(handle);
    handles[corner] = handle;
  });

  const toolbar = document.createElement("div");
  Object.assign(toolbar.style, {
    position: "fixed",
    bottom: "24px",
    left: "50%",
    transform: "translateX(-50%)",
    display: "none",
    gap: "8px",
    background: "#1f361f",
    border: "1px solid #2d4a2d",
    borderRadius: "8px",
    padding: "8px",
    zIndex: "2147483001",
  });
  root.appendChild(toolbar);

  const confirmBtn = document.createElement("button");
  confirmBtn.type = "button";
  confirmBtn.textContent = "Confirm crop";
  Object.assign(confirmBtn.style, {
    background: "#2d4a2d",
    border: "1px solid #4ADE80",
    borderRadius: "6px",
    padding: "8px 14px",
    color: "#4ADE80",
    fontSize: "13px",
    cursor: "pointer",
  });

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.textContent = "Cancel";
  Object.assign(cancelBtn.style, {
    background: "transparent",
    border: "1px solid #5a7a5a",
    borderRadius: "6px",
    padding: "8px 14px",
    color: "#c4e8c4",
    fontSize: "13px",
    cursor: "pointer",
  });

  toolbar.appendChild(confirmBtn);
  toolbar.appendChild(cancelBtn);

  let selX = 0;
  let selY = 0;
  let selW = 0;
  let selH = 0;
  let hasSelection = false;

  let mode: CropDragMode = "none";
  let dragStartX = 0;
  let dragStartY = 0;
  let dragOrigin = { x: 0, y: 0, w: 0, h: 0 };
  let anchorX = 0;
  let anchorY = 0;

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  function render() {
    if (!hasSelection) {
      rectEl.style.display = "none";
      tooltip.style.display = "none";
      corners.forEach((corner) => (handles[corner].style.display = "none"));
      toolbar.style.display = "none";
      return;
    }

    rectEl.style.display = "block";
    rectEl.style.left = `${selX}px`;
    rectEl.style.top = `${selY}px`;
    rectEl.style.width = `${selW}px`;
    rectEl.style.height = `${selH}px`;

    const positions: Record<CropCorner, [number, number]> = {
      nw: [selX, selY],
      ne: [selX + selW, selY],
      sw: [selX, selY + selH],
      se: [selX + selW, selY + selH],
    };
    const showHandles = selW > 4 && selH > 4;
    corners.forEach((corner) => {
      const [hx, hy] = positions[corner];
      const handle = handles[corner];
      handle.style.left = `${hx - HANDLE_SIZE / 2}px`;
      handle.style.top = `${hy - HANDLE_SIZE / 2}px`;
      handle.style.display = showHandles ? "block" : "none";
    });

    tooltip.textContent = `${Math.round(selW)} x ${Math.round(selH)}`;
    tooltip.style.display = selW > 0 && selH > 0 ? "block" : "none";
    tooltip.style.left = `${selX}px`;
    tooltip.style.top = `${Math.max(0, selY - 22)}px`;

    toolbar.style.display = showHandles ? "flex" : "none";
  }

  function onDocMouseMove(e: MouseEvent) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cx = clamp(e.clientX, 0, vw);
    const cy = clamp(e.clientY, 0, vh);

    if (mode === "drawing") {
      selX = Math.min(dragStartX, cx);
      selY = Math.min(dragStartY, cy);
      selW = Math.abs(cx - dragStartX);
      selH = Math.abs(cy - dragStartY);
    } else if (mode === "moving") {
      const dx = cx - dragStartX;
      const dy = cy - dragStartY;
      selX = clamp(dragOrigin.x + dx, 0, Math.max(0, vw - dragOrigin.w));
      selY = clamp(dragOrigin.y + dy, 0, Math.max(0, vh - dragOrigin.h));
      selW = dragOrigin.w;
      selH = dragOrigin.h;
    } else if (mode === "resizing") {
      selX = Math.min(anchorX, cx);
      selY = Math.min(anchorY, cy);
      selW = Math.abs(cx - anchorX);
      selH = Math.abs(cy - anchorY);
    }
    render();
  }

  function onDocMouseUp() {
    mode = "none";
    document.removeEventListener("mousemove", onDocMouseMove);
    document.removeEventListener("mouseup", onDocMouseUp);
  }

  function beginDocumentDrag() {
    document.addEventListener("mousemove", onDocMouseMove);
    document.addEventListener("mouseup", onDocMouseUp);
  }

  overlay.addEventListener("mousedown", (e) => {
    if (e.target !== overlay) return;
    hasSelection = true;
    mode = "drawing";
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    selX = e.clientX;
    selY = e.clientY;
    selW = 0;
    selH = 0;
    render();
    beginDocumentDrag();
    e.preventDefault();
  });

  rectEl.addEventListener("mousedown", (e) => {
    e.stopPropagation();
    mode = "moving";
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragOrigin = { x: selX, y: selY, w: selW, h: selH };
    beginDocumentDrag();
    e.preventDefault();
  });

  corners.forEach((corner) => {
    handles[corner].addEventListener("mousedown", (e) => {
      e.stopPropagation();
      mode = "resizing";
      const opposite: Record<CropCorner, [number, number]> = {
        nw: [selX + selW, selY + selH],
        ne: [selX, selY + selH],
        sw: [selX + selW, selY],
        se: [selX, selY],
      };
      [anchorX, anchorY] = opposite[corner];
      beginDocumentDrag();
      e.preventDefault();
    });
  });

  function destroy() {
    document.removeEventListener("mousemove", onDocMouseMove);
    document.removeEventListener("mouseup", onDocMouseUp);
    root.remove();
    closeActiveCropOverlay = null;
  }
  closeActiveCropOverlay = destroy;

  cancelBtn.addEventListener("mousedown", (e) => e.stopPropagation());
  cancelBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    destroy();
    onCancel();
  });

  confirmBtn.addEventListener("mousedown", (e) => e.stopPropagation());
  confirmBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!hasSelection || selW < 1 || selH < 1) {
      destroy();
      onCancel();
      return;
    }
    cropImageDataUrl(imageDataUrl, selX, selY, selW, selH)
      .then((cropped) => {
        destroy();
        onConfirm(cropped);
      })
      .catch((error) => {
        console.error("BeHeld: failed to crop screenshot", error);
        destroy();
        onCancel();
      });
  });

  render();
}

// Forces any open crop overlay closed without invoking its confirm/cancel callbacks —
// used when a new capture is about to remount the strip out from under it, since
// #beheld-crop-root is a separate top-level node that mountStrip() never otherwise touches.
function closeCropOverlayIfOpen() {
  if (closeActiveCropOverlay) {
    closeActiveCropOverlay();
  } else {
    document.getElementById("beheld-crop-root")?.remove();
  }
}

// ── STRIP COMPONENT ────────────────────────────────────────
function DecisionStrip({
  dataUrl,
  folders,
  startWithClipboardOpen,
}: {
  dataUrl: string | null;
  folders: string[];
  startWithClipboardOpen?: boolean;
}) {
  const [state, setState] = useState<StripState>(dataUrl ? "prompt" : "dismissed");
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);
  const [workingDataUrl, setWorkingDataUrl] = useState(dataUrl);
  const [cropping, setCropping] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [localFolders, setLocalFolders] = useState<string[]>(folders);
  const [confirmingDeleteFolder, setConfirmingDeleteFolder] = useState<string | null>(null);
  const [clipboardOpen, setClipboardOpen] = useState(false);
  const clipboard = useClipboardItems();
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [confirmationFading, setConfirmationFading] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  // Always reflects the latest clipboardOpen value for the confirmation-completion
  // timer below, which is scheduled once and must not act on a stale closure.
  const clipboardOpenRef = useRef(clipboardOpen);
  useEffect(() => {
    clipboardOpenRef.current = clipboardOpen;
  }, [clipboardOpen]);

  // Stage 1: collapse prompt after 4 seconds — paused while the clipboard panel is open
  // or a confirmation is showing.
  useEffect(() => {
    if (clipboardOpen || confirmation) return;
    const timer1 = setTimeout(() => {
      if (state === "prompt") setState("dismissed");
    }, 4000);
    return () => clearTimeout(timer1);
  }, [state, clipboardOpen, confirmation]);

  // Stage 2: fade out strip after 8 more seconds — paused while the clipboard panel is open
  // or a confirmation is showing.
  useEffect(() => {
    if (clipboardOpen || confirmation) return;
    if (state === "dismissed") {
      const timer2 = setTimeout(() => {
        setFading(true);
        setTimeout(() => setVisible(false), 600);
      }, 8000);
      return () => clearTimeout(timer2);
    }
  }, [state, clipboardOpen, confirmation]);

  // Holds the confirmation on screen for its full duration, then starts the fade-out.
  useEffect(() => {
    if (!confirmation || confirmationFading) return;
    const holdMs = confirmation.kind === "success" ? 1500 : 2000;
    const holdTimer = setTimeout(() => setConfirmationFading(true), holdMs);
    return () => clearTimeout(holdTimer);
  }, [confirmation, confirmationFading]);

  // Once the fade-out (400ms) finishes, either unmount the whole strip (clipboard panel
  // closed) or just clear the confirmation and return the icon column to normal (panel open).
  useEffect(() => {
    if (!confirmation || !confirmationFading) return;
    const fadeTimer = setTimeout(() => {
      setConfirmation(null);
      setConfirmationFading(false);
      setState("dismissed");
      if (!clipboardOpenRef.current) {
        setVisible(false);
      }
    }, 400);
    return () => clearTimeout(fadeTimer);
  }, [confirmation, confirmationFading]);

  const showConfirmation = (kind: "success" | "error", message: string) => {
    setConfirmationFading(false);
    setConfirmation({ kind, message });
  };

  // Opened directly from the popup (no screenshot) — jump straight to the clipboard panel.
  useEffect(() => {
    if (!startWithClipboardOpen) return;
    setClipboardOpen(true);
    clipboard.load();
  }, [startWithClipboardOpen]);

  // The crop overlay is plain DOM/canvas work, mounted and torn down outside React
  // whenever "cropping" toggles on — it never changes "state", only workingDataUrl.
  useEffect(() => {
    if (!cropping || !workingDataUrl) return;
    openCropOverlay(
      workingDataUrl,
      (croppedDataUrl) => {
        setWorkingDataUrl(croppedDataUrl);
        setCropping(false);
      },
      () => {
        setCropping(false);
      }
    );
  }, [cropping]);

  if (!visible) return null;

  const regularFolders = localFolders.filter((f) => f !== "Temp");
  const hasTemp = localFolders.includes("Temp");

  const openClipboard = () => {
    setClipboardOpen(true);
    clipboard.load();
  };

  const handleDeleteFolder = (name: string) => {
    chrome.runtime.sendMessage({ type: "DELETE_FOLDER", folderName: name }, (response) => {
      if (response?.success) {
        setLocalFolders((prev) => prev.filter((f) => f !== name));
      } else {
        console.error(`BeHeld: failed to delete folder ${name}`);
      }
      setConfirmingDeleteFolder(null);
    });
  };

  // Picks an arbitrary OS folder via the native picker and saves the current
  // workingDataUrl there. Whether that folder is remembered as a permanent BeHeld
  // folder depends on a best-effort check performed by the offscreen document (see
  // CHECK_FOLDER_UNDER_ROOT below) — see the long comment on saveDataUrlToDirectory
  // for why the picked handle itself can never be sent there for a true identity check.
  const handleBrowseFolder = async () => {
    if (!workingDataUrl || browsing) return;

    let handle: FileSystemDirectoryHandle;
    try {
      handle = await (window as any).showDirectoryPicker({ mode: "readwrite" });
    } catch (error) {
      // User cancelled the native picker — nothing to do, no error to surface.
      console.debug("BeHeld: browse folder picker cancelled", error);
      return;
    }

    setBrowsing(true);
    try {
      await saveDataUrlToDirectory(handle, workingDataUrl);
    } catch (error) {
      console.error("BeHeld: failed to save to browsed folder", error);
      showConfirmation("error", "Something went wrong");
      setBrowsing(false);
      return;
    }

    chrome.runtime.sendMessage(
      { type: "CHECK_FOLDER_UNDER_ROOT", folderName: handle.name },
      (response) => {
        const contained = response?.contained === true;

        if (contained && !localFolders.includes(handle.name)) {
          chrome.runtime.sendMessage(
            { type: "ADD_KNOWN_FOLDER", folderName: handle.name },
            (addResponse) => {
              if (addResponse?.folders) setLocalFolders(addResponse.folders);
            }
          );
        }

        showConfirmation(
          "success",
          contained
            ? `Saved to ${handle.name}`
            : "Saved outside your BeHeld folder — one-time, not remembered"
        );
        setBrowsing(false);
      }
    );
  };

  // Exports workingDataUrl (respecting any crop already applied) as a single-page PDF
  // built by the offscreen document, then downloads it via the same
  // fetch-then-blob-URL-anchor pattern used for OS-picked folder saves.
  const handleExportPdf = () => {
    if (!workingDataUrl || exportingPdf) return;
    setExportingPdf(true);

    chrome.runtime.sendMessage(
      { type: "EXPORT_PDF", dataUrl: workingDataUrl },
      async (response) => {
        const pdfDataUrl = response?.pdfDataUrl;
        if (!pdfDataUrl) {
          console.error("BeHeld: failed to export PDF", chrome.runtime.lastError);
          showConfirmation("error", "Something went wrong");
          setExportingPdf(false);
          return;
        }

        try {
          const res = await fetch(pdfDataUrl);
          const blob = await res.blob();
          const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
          const filename = `screenshot-${timestamp}.pdf`;

          const url = URL.createObjectURL(blob);
          const anchor = document.createElement("a");
          anchor.href = url;
          anchor.download = filename;
          document.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
          URL.revokeObjectURL(url);

          showConfirmation("success", "Saved as PDF");
        } catch (error) {
          console.error("BeHeld: failed to download PDF", error);
          showConfirmation("error", "Something went wrong");
        } finally {
          setExportingPdf(false);
        }
      }
    );
  };

  const renderFolderRow = (folder: string) => (
    <div key={folder} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
      {confirmingDeleteFolder === folder ? (
        <div style={{ display: "flex", alignItems: "center", gap: "6px", width: "100%" }}>
          <span style={{ flex: 1, fontSize: "11px", color: "#c4e8c4" }}>Delete "{folder}"?</span>
          <button
            onClick={() => handleDeleteFolder(folder)}
            style={{ border: "none", background: "transparent", color: "#e2685f", cursor: "pointer", fontSize: "11px" }}
          >
            Yes
          </button>
          <button
            onClick={() => setConfirmingDeleteFolder(null)}
            style={{ border: "none", background: "transparent", color: "#5a7a5a", cursor: "pointer", fontSize: "11px" }}
          >
            Cancel
          </button>
        </div>
      ) : (
        <>
          <button
            onClick={() => {
              chrome.runtime.sendMessage(
                { type: "SAVE_SCREENSHOT", folderName: folder, dataUrl: workingDataUrl },
                (response) => {
                  if (response?.success) {
                    showConfirmation("success", `Saved to ${folder}`);
                  } else {
                    console.error(`BeHeld: failed to save to ${folder}`, chrome.runtime.lastError);
                    showConfirmation("error", "Something went wrong");
                  }
                }
              );
            }}
            style={{
              flex: 1,
              background: folder === "Temp" ? "#2a2008" : "#2d4a2d",
              border: folder === "Temp" ? "1px solid #6a4e0a" : "1px solid #3a5e3a",
              borderRadius: "6px",
              padding: "8px 12px",
              color: folder === "Temp" ? "#F59E0B" : "#c4e8c4",
              fontSize: "13px",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            📁 {folder}
          </button>
          <button
            onClick={() => setConfirmingDeleteFolder(folder)}
            title={`Delete ${folder}`}
            style={{ border: "none", background: "transparent", color: "#5a7a5a", cursor: "pointer", fontSize: "12px", padding: "2px" }}
          >
            🗑
          </button>
        </>
      )}
    </div>
  );

  return (
    <div
      style={{
        position: "fixed",
        top: "80px",
        right: "0",
        zIndex: 999999,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        opacity: fading ? 0 : 1,
        transition: "opacity 0.6s ease",
      }}
    >
      {confirmation ? (
        <div
          style={{
            background: "#1A2E1A",
            color: confirmation.kind === "success" ? "#4ADE80" : "#F59E0B",
            borderRadius: "6px 0 0 6px",
            padding: "10px 14px",
            fontSize: "13px",
            whiteSpace: "nowrap",
            opacity: confirmationFading ? 0 : 1,
            transition: "opacity 0.4s ease",
          }}
        >
          {confirmation.kind === "success" ? "✓" : "✕"} {confirmation.message}
        </div>
      ) : (
      <div style={{ display: "flex", alignItems: "flex-start" }}>
        {state === "prompt" && (
          <div
            style={{
              background: "#1e2a1e",
              color: "#c8e8c8",
              padding: "10px 14px",
              borderRadius: "8px",
              fontSize: "13px",
              lineHeight: "1.5",
              marginRight: "8px",
              marginTop: "10px",
              border: "1px solid #2d4a2d",
              position: "relative",
              whiteSpace: "nowrap",
            }}
          >
            Save screenshot somewhere else?
            <div
              style={{
                position: "absolute",
                right: "-8px",
                top: "50%",
                transform: "translateY(-50%)",
                width: 0,
                height: 0,
                borderTop: "6px solid transparent",
                borderBottom: "6px solid transparent",
                borderLeft: "8px solid #1e2a1e",
              }}
            />
          </div>
        )}

        {state === "folders" && dataUrl && (
          <div
            style={{
              background: "#1f361f",
              border: "1px solid #2d4a2d",
              borderRadius: "8px 0 0 8px",
              padding: "12px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              minWidth: "160px",
            }}
          >
            <div style={{ fontSize: "11px", color: "#5a7a5a", marginBottom: "4px" }}>
              Where should this go?
            </div>

            {regularFolders.map(renderFolderRow)}
            {hasTemp && renderFolderRow("Temp")}

            {!creatingFolder ? (
              <button
                onClick={() => setCreatingFolder(true)}
                style={{
                  background: "transparent",
                  border: "1px dashed #3a5e3a",
                  borderRadius: "6px",
                  padding: "8px 12px",
                  color: "#4ADE80",
                  fontSize: "13px",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                + New folder
              </button>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <input
                  autoFocus
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newFolderName.trim()) {
                      const trimmedName = newFolderName.trim();
                      chrome.runtime.sendMessage(
                        { type: "SAVE_SCREENSHOT", folderName: trimmedName, dataUrl: workingDataUrl },
                        (response) => {
                          if (response?.success) {
                            setCreatingFolder(false);
                            setNewFolderName("");
                            showConfirmation("success", `Saved to ${trimmedName}`);
                          } else {
                            console.error("BeHeld: failed to save to new folder", chrome.runtime.lastError);
                            showConfirmation("error", "Something went wrong");
                          }
                        }
                      );
                    }
                    if (e.key === "Escape") {
                      setCreatingFolder(false);
                      setNewFolderName("");
                    }
                  }}
                  placeholder="Folder name..."
                  style={{
                    background: "#1a2e1a",
                    border: "1px solid #4ADE80",
                    borderRadius: "6px",
                    padding: "8px 12px",
                    color: "#c4e8c4",
                    fontSize: "13px",
                    outline: "none",
                  }}
                />
                <div style={{ fontSize: "11px", color: "#5a7a5a" }}>
                  Press Enter to save · Esc to cancel
                </div>
              </div>
            )}

            <button
              onClick={() => setCropping(true)}
              style={{
                background: "transparent",
                border: "1px dashed #3a5e3a",
                borderRadius: "6px",
                padding: "8px 12px",
                color: "#4ADE80",
                fontSize: "13px",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              ✂ Crop screenshot
            </button>

            <button
              onClick={() => {
                copyImageToClipboard(workingDataUrl!).then(() => {
                  showConfirmation("success", "Copied to clipboard");
                });
              }}
              style={{
                background: "transparent",
                border: "none",
                color: "#5a7a5a",
                fontSize: "12px",
                cursor: "pointer",
                marginTop: "4px",
              }}
            >
              Copy to clipboard only
            </button>

            <button
              onClick={handleBrowseFolder}
              disabled={browsing}
              style={{
                background: "transparent",
                border: "1px dashed #3a5e3a",
                borderRadius: "6px",
                padding: "8px 12px",
                color: "#4ADE80",
                fontSize: "13px",
                cursor: browsing ? "default" : "pointer",
                textAlign: "left",
                opacity: browsing ? 0.6 : 1,
              }}
            >
              🗂 Browse...
            </button>

            <button
              onClick={handleExportPdf}
              disabled={exportingPdf}
              style={{
                background: "transparent",
                border: "1px dashed #3a5e3a",
                borderRadius: "6px",
                padding: "8px 12px",
                color: "#4ADE80",
                fontSize: "13px",
                cursor: exportingPdf ? "default" : "pointer",
                textAlign: "left",
                opacity: exportingPdf ? 0.6 : 1,
              }}
            >
              📄 Save as PDF
            </button>
          </div>
        )}

        <div
          onClick={() => {
            if (dataUrl && state === "dismissed") setState("prompt");
          }}
          style={{
            background: "#1A2E1A",
            borderRadius: "6px 0 0 6px",
            width: "36px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "10px 0",
            gap: "12px",
            cursor: dataUrl && state === "dismissed" ? "pointer" : "default",
          }}
        >
          {dataUrl && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                setState("folders");
              }}
              style={{
                color: "#4ADE80",
                fontSize: "18px",
                cursor: "pointer",
                lineHeight: 1,
              }}
              title="Save to folder"
            >
              📁
            </div>
          )}

          {dataUrl && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                copyImageToClipboard(workingDataUrl!).then(() => {
                  showConfirmation("success", "Copied to clipboard");
                });
              }}
              style={{
                color: "#4ADE80",
                fontSize: "18px",
                cursor: "pointer",
                lineHeight: 1,
              }}
              title="Copy to clipboard"
            >
              📋
            </div>
          )}

          <div
            onClick={(e) => {
              e.stopPropagation();
              if (clipboardOpen) {
                setClipboardOpen(false);
              } else {
                openClipboard();
              }
            }}
            style={{
              color: "#4ADE80",
              fontSize: "18px",
              cursor: "pointer",
              lineHeight: 1,
              background: clipboardOpen ? "#243b24" : "transparent",
              borderRadius: "4px",
              padding: "2px",
            }}
            title="Clipboard history"
          >
            📑
          </div>

          <div style={{ color: "#3a5a3a", fontSize: "10px", letterSpacing: "1px" }}>
            ···
          </div>
        </div>
      </div>
      )}

      {clipboardOpen && (
        <div
          style={{
            width: "140px",
            background: "#1f361f",
            border: "1px solid #2d4a2d",
            borderRadius: "0 0 0 8px",
            padding: "7px",
            display: "flex",
            flexDirection: "column",
            gap: "5px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1px" }}>
            <span style={{ fontSize: "9px", color: "#8fae8f", fontWeight: 500, letterSpacing: "0.3px" }}>
              CLIPBOARD
            </span>
            <button
              onClick={() => setClipboardOpen(false)}
              title="Close"
              style={{ border: "none", background: "transparent", color: "#5a7a5a", cursor: "pointer", fontSize: "11px", lineHeight: 1 }}
            >
              ✕
            </button>
          </div>

          <ClipboardList items={clipboard.items} onDelete={clipboard.deleteItem} onRecopy={clipboard.recopy} />
        </div>
      )}
    </div>
  );
}

// ── CAPTURE FLASH ──────────────────────────────────────────
function showCaptureFlash() {
  const existing = document.getElementById("beheld-flash-overlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "beheld-flash-overlay";
  overlay.style.position = "fixed";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.width = "100vw";
  overlay.style.height = "100vh";
  overlay.style.background = "#fff";
  overlay.style.opacity = "0.6";
  overlay.style.pointerEvents = "none";
  overlay.style.zIndex = "1000000";
  overlay.style.transition = "opacity 150ms";

  document.body.appendChild(overlay);

  requestAnimationFrame(() => {
    overlay.style.opacity = "0";
  });

  setTimeout(() => {
    overlay.remove();
  }, 150);
}

// ── MOUNT ──────────────────────────────────────────────────
function mountStrip(dataUrl: string | null, folders: string[], startWithClipboardOpen?: boolean) {
  closeCropOverlayIfOpen();

  const existing = document.getElementById("beheld-strip-root");
  if (existing) existing.remove();

  const container = document.createElement("div");
  container.id = "beheld-strip-root";
  document.body.appendChild(container);

  createRoot(container).render(
    <DecisionStrip dataUrl={dataUrl} folders={folders} startWithClipboardOpen={startWithClipboardOpen} />
  );
}

function mountLibrary(folders: string[]) {
  const existing = document.getElementById("beheld-library-root");
  if (existing) existing.remove();

  const container = document.createElement("div");
  container.id = "beheld-library-root";
  document.body.appendChild(container);

  createRoot(container).render(<LibraryPanel folders={folders} />);
}

// ── LISTEN FOR MESSAGE FROM SERVICE WORKER ─────────────────
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "SHOW_STRIP") {
    if (message.dataUrl) showCaptureFlash();
    mountStrip(message.dataUrl ?? null, message.folders ?? ["Temp"], message.openClipboard);
  }

  if (message.type === "SHOW_LIBRARY") {
    mountLibrary(message.folders ?? ["Temp"]);
  }
});
