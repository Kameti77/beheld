import { useState, useEffect, type ReactNode } from "react";
import { get, set } from "idb-keyval";
import { color, space, radius, font } from "../design/tokens";
import { Button } from "../design/Button";
import {
  IconCamera,
  IconFullPage,
  IconLibrary,
  IconSettings,
  IconBack,
  IconCheck,
  IconFolder,
} from "../design/icons";

const POPUP_WIDTH = 320;

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p
      style={{
        fontSize: font.size.sm,
        fontWeight: font.weight.medium,
        color: color.textSecondary,
        margin: 0,
        marginBottom: space.sm,
      }}
    >
      {children}
    </p>
  );
}

function Caption({ children }: { children: ReactNode }) {
  return (
    <p
      style={{
        fontSize: font.size.xs,
        color: color.textMuted,
        lineHeight: 1.5,
        margin: 0,
        marginTop: space.sm,
      }}
    >
      {children}
    </p>
  );
}

function FolderChip({ label }: { label: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: space.sm,
        background: color.bgElevated,
        border: `1px solid ${color.border}`,
        borderRadius: radius.md,
        padding: `${space.sm}px ${space.md}px`,
        marginBottom: space.sm,
      }}
    >
      <IconFolder size={14} color={color.brand} />
      <span
        style={{
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
          fontSize: font.size.sm,
          color: color.brand,
          wordBreak: "break-all",
        }}
      >
        {label}
      </span>
    </div>
  );
}

function InlineConfirmation({ text }: { text: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: space.xs,
        fontSize: font.size.xs,
        color: color.success,
        background: "rgba(74,222,128,0.10)",
        borderRadius: radius.sm,
        padding: `${space.xs}px ${space.sm}px`,
        marginTop: space.sm,
      }}
    >
      <IconCheck size={13} />
      {text}
    </div>
  );
}

function Divider() {
  return (
    <div
      style={{
        height: 1,
        background: color.border,
        margin: `${space.lg}px 0`,
      }}
    />
  );
}

function Popup() {
  const [isReady, setIsReady] = useState<boolean | null>(null);
  const [viewMode, setViewMode] = useState<"main" | "settings">("main");
  const [rootHandle, setRootHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [defaultFolderHandle, setDefaultFolderHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [showDefaultFolderConfirmation, setShowDefaultFolderConfirmation] = useState(false);

  useEffect(() => {
    get("beheld-root-handle").then((handle) => {
      setIsReady(handle != null);
      setRootHandle(handle ?? null);
    });
    get("beheld-default-folder-handle").then((handle) => {
      setDefaultFolderHandle(handle ?? null);
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

  const handleChooseDefaultFolder = async () => {
    try {
      const handle = await (window as any).showDirectoryPicker({ mode: "readwrite" });
      await set("beheld-default-folder-handle", handle);
      setDefaultFolderHandle(handle);
      setShowDefaultFolderConfirmation(true);
      setTimeout(() => setShowDefaultFolderConfirmation(false), 1500);
    } catch {
      console.log("Default folder picker cancelled");
    }
  };

  const handleCapture = () => {
    chrome.runtime.sendMessage({ type: "CAPTURE_SCREENSHOT" }, () => { window.close(); });
  };

  const handleCaptureFullPage = () => {
    chrome.runtime.sendMessage({ type: "CAPTURE_FULL_PAGE" }, () => { window.close(); });
  };

  const handleOpenLibrary = () => {
    chrome.runtime.sendMessage({ type: "OPEN_LIBRARY" }, () => { window.close(); });
  };

  const shellStyle = {
    width: POPUP_WIDTH,
    padding: space.xl,
    background: color.bgBase,
    color: color.textPrimary,
    fontFamily: font.family,
    boxSizing: "border-box" as const,
  };

  if (isReady === null) {
    return <div style={shellStyle} />;
  }

  if (!isReady) {
    return (
      <div style={shellStyle}>
        <h1
          style={{
            fontSize: font.size.xl,
            fontWeight: font.weight.semibold,
            margin: 0,
            marginBottom: space.sm,
          }}
        >
          Welcome to BeHeld
        </h1>
        <p
          style={{
            fontSize: font.size.base,
            color: color.textSecondary,
            lineHeight: 1.6,
            margin: 0,
            marginBottom: space.xl,
          }}
        >
          Choose where BeHeld should save your screenshots. This is a one-time setup — you can change it later.
        </p>
        <Button variant="primary" fullWidth onClick={handlePickFolder}>
          Choose screenshots folder
        </Button>
      </div>
    );
  }

  if (viewMode === "settings") {
    const isMac = navigator.platform.includes("Mac");
    const shortcutKeys = isMac ? ["⌘", "Shift", "S"] : ["Ctrl", "Shift", "S"];

    return (
      <div style={shellStyle}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "28px 1fr 28px",
            alignItems: "center",
            marginBottom: space.xl,
          }}
        >
          <button
            onClick={() => setViewMode("main")}
            aria-label="Back"
            className="bh-icon-btn"
            style={{ justifySelf: "start" }}
          >
            <IconBack size={16} />
          </button>
          <h1
            style={{
              fontSize: font.size.lg,
              fontWeight: font.weight.semibold,
              margin: 0,
              textAlign: "center",
            }}
          >
            Settings
          </h1>
          <div />
        </div>

        <SectionLabel>Where your screenshots are saved</SectionLabel>
        <FolderChip label={rootHandle?.name ?? "Unknown"} />
        <Button variant="secondary" size="sm" fullWidth onClick={handleChangeFolder}>
          Change folder
        </Button>
        {showConfirmation && <InlineConfirmation text="Folder updated" />}
        <Caption>
          BeHeld saves every screenshot into subfolders inside this location. Changing it does not move your existing screenshots.
        </Caption>

        <Divider />

        <SectionLabel>Default quick-save folder</SectionLabel>
        <FolderChip label={defaultFolderHandle ? defaultFolderHandle.name : "Not set"} />
        <Button variant="secondary" size="sm" fullWidth onClick={handleChooseDefaultFolder}>
          {defaultFolderHandle ? "Change folder" : "Choose folder"}
        </Button>
        {showDefaultFolderConfirmation && <InlineConfirmation text="Default folder updated" />}
        <Caption>
          BeHeld will quick-save screenshots straight to this folder, without asking each time.
        </Caption>

        <Divider />

        <SectionLabel>Trigger a screenshot</SectionLabel>
        <div style={{ display: "flex", alignItems: "center", gap: space.xs }}>
          {shortcutKeys.map((key, i) => (
            <span key={i} style={{ display: "flex", alignItems: "center", gap: space.xs }}>
              <span
                style={{
                  background: color.bgElevated,
                  color: color.textPrimary,
                  border: `1px solid ${color.border}`,
                  borderRadius: radius.sm,
                  padding: "4px 8px",
                  fontSize: font.size.sm,
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                }}
              >
                {key}
              </span>
              {i < shortcutKeys.length - 1 && (
                <span style={{ fontSize: font.size.sm, color: color.textMuted }}>+</span>
              )}
            </span>
          ))}
        </div>
        <Caption>
          Press this anywhere in Chrome to capture the current tab instantly, without opening the popup.
        </Caption>
      </div>
    );
  }

  return (
    <div style={{ ...shellStyle, position: "relative" }}>
      <button
        onClick={() => setViewMode("settings")}
        aria-label="Settings"
        className="bh-icon-btn"
        style={{ position: "absolute", top: space.lg, right: space.lg }}
      >
        <IconSettings size={16} />
      </button>

      <h1
        style={{
          fontSize: font.size.lg,
          fontWeight: font.weight.semibold,
          margin: 0,
          marginBottom: 2,
        }}
      >
        BeHeld
      </h1>
      <p
        style={{
          fontSize: font.size.sm,
          color: color.textSecondary,
          margin: 0,
          marginBottom: space.xl,
        }}
      >
        Hold what matters. Let go of the rest.
      </p>

      <Button variant="primary" fullWidth icon={<IconCamera size={16} />} onClick={handleCapture}>
        Take screenshot
      </Button>
      <p
        style={{
          fontSize: font.size.xs,
          color: color.textMuted,
          margin: 0,
          marginTop: space.sm,
          marginBottom: space.lg,
        }}
      >
        or press {navigator.platform.includes("Mac") ? "⌘+Shift+S" : "Ctrl+Shift+S"} anywhere
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: space.sm }}>
        <Button variant="secondary" fullWidth icon={<IconFullPage size={16} />} onClick={handleCaptureFullPage}>
          Full-page screenshot
        </Button>
        <Button variant="secondary" fullWidth icon={<IconLibrary size={16} />} onClick={handleOpenLibrary}>
          Library &amp; clipboard
        </Button>
      </div>

      {showConfirmation && <InlineConfirmation text="Root folder updated" />}
    </div>
  );
}

export default Popup;
