import { useState, useEffect } from "react";
import { get, set } from "idb-keyval";

function Popup() {
  const [isReady, setIsReady] = useState<boolean | null>(null);
  const [viewMode, setViewMode] = useState<"main" | "settings">("main");
  const [rootHandle, setRootHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  useEffect(() => {
    get("beheld-root-handle").then((handle) => {
      setIsReady(handle != null);
      setRootHandle(handle ?? null);
    });
  }, []);

  const handlePickFolder = async () => {
    try {
      const handle = await (window as any).showDirectoryPicker({ mode: "readwrite" });
      await set("beheld-root-handle", handle);
      setRootHandle(handle);
      setIsReady(true);
    } catch {
      console.log("Folder picker cancelled");
    }
  };

  const handleChangeFolder = async () => {
    try {
      const handle = await (window as any).showDirectoryPicker({ mode: "readwrite" });
      await set("beheld-root-handle", handle);
      setRootHandle(handle);
      setShowConfirmation(true);
      setTimeout(() => setShowConfirmation(false), 1500);
    } catch {
      console.log("Folder picker cancelled");
    }
  };

  const handleCapture = () => {
    chrome.runtime.sendMessage(
      { type: "CAPTURE_SCREENSHOT" },
      () => { window.close(); }
    );
  };

  const handleOpenLibrary = () => {
    chrome.runtime.sendMessage(
      { type: "OPEN_LIBRARY" },
      () => { window.close(); }
    );
  };

  if (isReady === null) {
    return <div style={{ width: 300, padding: 20 }}>Loading...</div>;
  }

  if (!isReady) {
    return (
      <div style={{ width: 320, padding: 24 }}>
        <h1 style={{ fontSize: 20, marginBottom: 8 }}>Welcome to BeHeld</h1>
        <p style={{ fontSize: 13, color: "#555", marginBottom: 20, lineHeight: 1.6 }}>
          First, choose where BeHeld should save your screenshots. This is a one-time setup.
        </p>
        <button
          onClick={handlePickFolder}
          style={{
            background: "#1A2E1A",
            color: "#4ADE80",
            border: "none",
            borderRadius: 8,
            padding: "10px 20px",
            fontSize: 14,
            cursor: "pointer",
            width: "100%",
          }}
        >
          Choose Screenshots Folder
        </button>
      </div>
    );
  }

  if (viewMode === "settings") {
    const isMac = navigator.platform.includes("Mac");
    const shortcutKeys = isMac ? ["⌘", "Shift", "S"] : ["Ctrl", "Shift", "S"];

    return (
      <div style={{ width: 300, padding: 20, background: "#1A2E1A", color: "#4ADE80" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "24px 1fr 24px",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <button
            onClick={() => setViewMode("main")}
            aria-label="Back"
            style={{
              background: "none",
              border: "none",
              color: "#4ADE80",
              fontSize: 16,
              cursor: "pointer",
              padding: 0,
              justifySelf: "start",
            }}
          >
            ←
          </button>
          <h1 style={{ fontSize: 18, margin: 0, textAlign: "center" }}>Settings</h1>
          <div />
        </div>

        <p style={{ fontSize: 13, marginBottom: 8 }}>Where your screenshots are saved</p>
        <div
          style={{
            background: "#1A2E1A",
            color: "#4ADE80",
            fontFamily: "monospace",
            fontSize: 13,
            border: "1px solid #2d4a2d",
            borderRadius: 8,
            padding: "10px 12px",
            marginBottom: 12,
            wordBreak: "break-all",
          }}
        >
          📁 {rootHandle?.name ?? "Unknown"}
        </div>
        <button
          onClick={handleChangeFolder}
          style={{
            background: "#4ADE80",
            color: "#1A2E1A",
            border: "none",
            borderRadius: 8,
            padding: "10px 20px",
            fontSize: 14,
            cursor: "pointer",
            width: "100%",
          }}
        >
          Change folder
        </button>
        {showConfirmation && (
          <p
            style={{
              fontSize: 12,
              color: "#4ADE80",
              background: "#1A2E1A",
              border: "1px solid #2d4a2d",
              padding: "6px 8px",
              borderRadius: 6,
              marginTop: 8,
              marginBottom: 0,
            }}
          >
            ✓ Folder updated
          </p>
        )}
        <p style={{ fontSize: 11, color: "#4ADE80", opacity: 0.65, marginTop: 8, marginBottom: 24, lineHeight: 1.5 }}>
          BeHeld saves all screenshots into subfolders inside this location. Changing it does not move your existing screenshots.
        </p>

        <p style={{ fontSize: 13, marginBottom: 8 }}>Trigger a screenshot</p>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          {shortcutKeys.map((key, i) => (
            <span key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  background: "#1A2E1A",
                  color: "#4ADE80",
                  border: "1px solid #2d4a2d",
                  borderRadius: 6,
                  padding: "4px 8px",
                  fontSize: 12,
                  fontFamily: "monospace",
                }}
              >
                {key}
              </span>
              {i < shortcutKeys.length - 1 && <span style={{ fontSize: 12, opacity: 0.65 }}>+</span>}
            </span>
          ))}
        </div>
        <p style={{ fontSize: 11, color: "#4ADE80", opacity: 0.65, marginTop: 0, marginBottom: 0, lineHeight: 1.5 }}>
          Press this anywhere in Chrome to capture the current tab instantly, without opening the popup.
        </p>
      </div>
    );
  }

  return (
    <div style={{ width: 300, padding: 20, position: "relative" }}>
      <button
        onClick={() => setViewMode("settings")}
        aria-label="Settings"
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          background: "none",
          border: "none",
          fontSize: 16,
          cursor: "pointer",
          padding: 0,
        }}
      >
        ⚙️
      </button>
      <h1>BeHeld</h1>
      <p>Hold what matters. Let go of the rest.</p>
      <button onClick={handleCapture} style={{ width: "100%", marginBottom: 4 }}>
        Take Screenshot
      </button>
      <p style={{ fontSize: 11, color: "#555", marginTop: 0, marginBottom: 8 }}>
        or press Ctrl+Shift+S anywhere
      </p>
      <button onClick={handleOpenLibrary} style={{ width: "100%" }}>
        Library & Clipboard
      </button>
      {showConfirmation && (
        <p
          style={{
            fontSize: 12,
            color: "#4ADE80",
            background: "#1A2E1A",
            padding: "6px 8px",
            borderRadius: 6,
            marginTop: 8,
          }}
        >
          ✓ Root folder updated
        </p>
      )}
    </div>
  );
}

export default Popup;