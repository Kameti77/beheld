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
      setViewMode("main");
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

  const handleOpenClipboard = () => {
    chrome.runtime.sendMessage(
      { type: "OPEN_CLIPBOARD_STRIP" },
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
    return (
      <div style={{ width: 300, padding: 20, background: "#1A2E1A", color: "#4ADE80" }}>
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
            marginBottom: 16,
          }}
        >
          ← Back
        </button>
        <h1 style={{ fontSize: 20, marginBottom: 8 }}>Settings</h1>
        <p style={{ fontSize: 13, marginBottom: 4 }}>Root folder</p>
        <p style={{ fontSize: 14, marginBottom: 20, fontWeight: 600 }}>
          {rootHandle?.name ?? "Unknown"}
        </p>
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
      <button onClick={handleOpenLibrary} style={{ width: "100%", marginBottom: 4 }}>
        Library
      </button>
      <button onClick={handleOpenClipboard} style={{ width: "100%" }}>
        Open Clipboard
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