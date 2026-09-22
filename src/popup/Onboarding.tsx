import { Button } from "../design/Button";
import { color, font, space } from "../design/tokens";
import { IconFolder } from "../design/icons";

interface Props {
  onComplete: () => void;
}

function Onboarding({ onComplete }: Props) {
  const handlePickFolder = async () => {
    try {
      const handle = await (window as any).showDirectoryPicker({ mode: "readwrite" });
      (chrome as any).runtime.sendMessage({ type: "SAVE_ROOT_HANDLE", handle }, onComplete);
    } catch (error) {
      console.log("Folder picker cancelled", error);
    }
  };

  return (
    <div style={{ width: 320, boxSizing: "border-box", padding: space.xl, background: color.bgBase, color: color.textPrimary, fontFamily: font.family }}>
      <div style={{ width: 36, height: 36, display: "grid", placeItems: "center", color: color.brand, background: "rgba(74,222,128,0.10)", borderRadius: 8, marginBottom: space.lg }}>
        <IconFolder size={18} />
      </div>
      <h1 style={{ margin: 0, fontSize: font.size.xl, fontWeight: font.weight.semibold }}>Welcome to BeHeld</h1>
      <p style={{ margin: `${space.sm}px 0 ${space.xl}px`, color: color.textSecondary, fontSize: font.size.base, lineHeight: 1.6 }}>
        Choose where BeHeld should save your screenshots. You can change this any time in Settings.
      </p>
      <Button variant="primary" fullWidth onClick={handlePickFolder}>Choose screenshots folder</Button>
    </div>
  );
}

export default Onboarding;
