// ─── Service Worker: Background Script ───────────────────────

// Create context menu on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "flowread-selection",
    title: "⚡ Read with FlowRead",
    contexts: ["selection"],
  });
});

// Handle context menu click
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "flowread-selection" && info.selectionText) {
    const text = info.selectionText.trim();
    if (!text) return;

    // Store the selected text so the reader window can pick it up
    chrome.storage.local.set({ pendingText: text }, () => {
      // Open reader in a new popup window — works on Mac & Windows
      const width  = 680;
      const height = 780;

      // Get screen info to center the window (best-effort; Chrome may adjust)
      chrome.windows.getCurrent({ populate: false }, (currentWindow) => {
        const left = Math.round(
          (currentWindow.left || 0) + ((currentWindow.width  || 1200) - width)  / 2
        );
        const top = Math.round(
          (currentWindow.top  || 0) + ((currentWindow.height || 800)  - height) / 2
        );

        chrome.windows.create({
          url: chrome.runtime.getURL("reader.html"),
          type: "popup",
          width,
          height,
          left,
          top,
          focused: true,
        });
      });
    });
  }
});
