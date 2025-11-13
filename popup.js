// popup.js

document.addEventListener("DOMContentLoaded", () => {
  const openOptionsBtn = document.getElementById("openOptions");
  const toggleSidebarBtn = document.getElementById("toggleSidebar");

  openOptionsBtn.addEventListener("click", () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL("options.html"));
    }
  });

  toggleSidebarBtn.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab || !tab.id) return;

      // 1) Inject the content script into this tab
      chrome.scripting.executeScript(
        {
          target: { tabId: tab.id },
          files: ["contentScript.js"]
        },
        () => {
          const injectError = chrome.runtime.lastError;
          if (injectError) {
            console.warn("Error injecting content script:", injectError.message);
            // We still try to send the message; if no listener, it will just no-op.
          }

          // 2) Ask the content script to toggle the sidebar
          chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_SIDEBAR" }, () => {
            const msgError = chrome.runtime.lastError;
            if (msgError) {
              console.warn("Toggle sidebar error:", msgError.message);
            }
          });
        }
      );
    });
  });
});
