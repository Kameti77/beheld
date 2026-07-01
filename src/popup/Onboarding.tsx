interface Props {
  onComplete: () => void;
}

function Onboarding({ onComplete }: Props) {
  const handlePickFolder = async () => {
    try {
      const handle = await (window as any).showDirectoryPicker({
        mode: "readwrite",
      });

      // Send handle to be stored via service worker message
      (chrome as any).runtime.sendMessage(
        { type: "SAVE_ROOT_HANDLE", handle },
        () => {
          onComplete();
        }
      );
    } catch (error) {
      // User cancelled the picker — do nothing
      console.log("Folder picker cancelled");
    }
  };

  return (
    <div style={{ width: 320, padding: 24 }}>
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>Welcome to BeHeld</h1>
      <p style={{ fontSize: 13, color: "#555", marginBottom: 20, lineHeight: 1.6 }}>
        First, choose where BeHeld should save your screenshots. This is a
        one-time setup.
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

export default Onboarding;