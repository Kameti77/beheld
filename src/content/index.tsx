import { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";

// ── TYPES ──────────────────────────────────────────────────
type StripState = "prompt" | "folders" | "dismissed";

// ── STRIP COMPONENT ────────────────────────────────────────
// async function saveScreenshot(folderName: string, dataUrl: string): Promise<boolean> {
//   try {
//     const rootHandle = await get<FileSystemDirectoryHandle>("beheld-root-handle");
//     if (!rootHandle) {
//       console.error("BeHeld: no root handle found");
//       return false;
//     }

//     const permission = await (rootHandle as unknown as {
//       requestPermission: (desc: { mode: string }) => Promise<string>;
//     }).requestPermission({ mode: "readwrite" });

//     if (permission !== "granted") {
//       console.error("BeHeld: permission denied");
//       return false;
//     }

//     const folderHandle = await rootHandle.getDirectoryHandle(folderName, { create: true });

//     const timestamp = new Date()
//       .toISOString()
//       .replace(/[:.]/g, "-")
//       .slice(0, 19);
//     const filename = `screenshot-${timestamp}.png`;

//     const response = await fetch(dataUrl);
//     const blob = await response.blob();

//     const fileHandle = await folderHandle.getFileHandle(filename, { create: true });
//     const writable = await fileHandle.createWritable();
//     await writable.write(blob);
//     await writable.close();

//     const folders = await get<string[]>("beheld-folders") ?? ["Temp"];
//     if (!folders.includes(folderName)) {
//       await set("beheld-folders", [...folders, folderName]);
//     }

//     return true;
//   } catch (error) {
//     console.error("BeHeld save error:", error);
//     return false;
//   }
// }

function DecisionStrip({ dataUrl }: { dataUrl: string }) {
  const [state, setState] = useState<StripState>("prompt");
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  // Stage 1: collapse prompt after 4 seconds
  useEffect(() => {
    const timer1 = setTimeout(() => {
      if (state === "prompt") setState("dismissed");
    }, 4000);
    return () => clearTimeout(timer1);
  }, [state]);

  // Stage 2: fade out strip after 8 more seconds
  useEffect(() => {
    if (state === "dismissed") {
      const timer2 = setTimeout(() => {
        setFading(true);
        setTimeout(() => setVisible(false), 600);
      }, 8000);
      return () => clearTimeout(timer2);
    }
  }, [state]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: "80px",
        right: "0",
        zIndex: 999999,
        display: "flex",
        alignItems: "flex-start",
        opacity: fading ? 0 : 1,
        transition: "opacity 0.6s ease",
      }}
    >
      {/* Speech bubble — prompt state only */}
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

      {/* Folder panel — folders state only */}
      {state === "folders" && (
        <div
          style={{
            background: "#1f361f",
            border: "1px solid #2d4a2d",
            borderRadius: "8px 0 0 8px",
            padding: "12px",
            marginRight: "0",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            minWidth: "160px",
          }}
        >
          <div style={{ fontSize: "11px", color: "#5a7a5a", marginBottom: "4px" }}>
            Where should this go?
          </div>

          {["Work", "School"].map((folder) => (
            <button
              key={folder}
              onClick={() => {
                chrome.runtime.sendMessage(
                  { type: "SAVE_SCREENSHOT", folderName: folder, dataUrl },
                  (response) => {
                    if (response?.success) {
                      console.log(`Saved to ${folder}`);
                      setVisible(false);
                    }
                  }
                );
              }}
              style={{
                background: "#2d4a2d",
                border: "1px solid #3a5e3a",
                borderRadius: "6px",
                padding: "8px 12px",
                color: "#c4e8c4",
                fontSize: "13px",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              📁 {folder}
            </button>
          ))}

          <button
            onClick={() => {
              chrome.runtime.sendMessage(
                { type: "SAVE_SCREENSHOT", folderName: "Temp", dataUrl },
                (response) => {
                  if (response?.success) {
                    console.log("Saved to Temp");
                    setVisible(false);
                  }
                }
              );
            }}
            style={{
              background: "#2a2008",
              border: "1px solid #6a4e0a",
              borderRadius: "6px",
              padding: "8px 12px",
              color: "#F59E0B",
              fontSize: "13px",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            📁 Temp
          </button>

          <button
            onClick={() => setVisible(false)}
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
        </div>
      )}

      {/* The vertical strip — always visible */}
      <div
        onClick={() => {
          if (state === "dismissed") setState("prompt");
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
          cursor: state === "dismissed" ? "pointer" : "default",
        }}
      >
        {/* Folder icon */}
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

        {/* Clipboard icon */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(dataUrl);
            setVisible(false);
          }}
          style={{
            color: "#4ADE80",
            fontSize: "18px",
            cursor: "pointer",
            lineHeight: 1,
          }}
          title="Copy to clipboard only"
        >
          📋
        </div>

        <div style={{ color: "#3a5a3a", fontSize: "10px", letterSpacing: "1px" }}>
          ···
        </div>
      </div>
    </div>
  );
}

// ── MOUNT ──────────────────────────────────────────────────
function mountStrip(dataUrl: string) {
  const existing = document.getElementById("beheld-strip-root");
  if (existing) existing.remove();

  const container = document.createElement("div");
  container.id = "beheld-strip-root";
  document.body.appendChild(container);

  createRoot(container).render(<DecisionStrip dataUrl={dataUrl} />);
}

// ── LISTEN FOR MESSAGE FROM SERVICE WORKER ─────────────────
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "SHOW_STRIP") {
    mountStrip(message.dataUrl);
  }
});