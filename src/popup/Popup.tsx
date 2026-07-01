import { useState, useEffect } from "react";
import { get, set } from "idb-keyval";
// import Onboarding from "./Onboarding";

function Popup() {
  const [isReady, setIsReady] = useState<boolean | null>(null);

  useEffect(() => {
    get("beheld-root-handle").then((handle) => {
      setIsReady(handle != null);
    });
  }, []);

  const handlePickFolder = async () => {
    try {
      const handle = await (window as any).showDirectoryPicker({ mode: "readwrite" });
      await set("beheld-root-handle", handle);
      setIsReady(true);
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

  return (
    <div style={{ width: 300, padding: 20 }}>
      <h1>BeHeld</h1>
      <p>Hold what matters. Let go of the rest.</p>
      <button onClick={handleCapture}>Take Screenshot</button>
    </div>
  );
}

export default Popup;