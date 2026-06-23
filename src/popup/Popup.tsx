function Popup() {
  const handleCapture = () => {
    chrome.runtime.sendMessage(
      { type: "CAPTURE_SCREENSHOT" },
      () => {
        window.close();
      }
    );
  };

  return (
    <div style={{ width: 300, padding: 20 }}>
      <h1>BeHeld</h1>
      <p>Hold what matters. Let go of the rest.</p>
      <button onClick={handleCapture}>Take Screenshot</button>
    </div>
  );
}

export default Popup;