// contentScript.js

(function () {
  if (window.__sidekickInjected) return;
  window.__sidekickInjected = true;

  let sidebarEl = null;

  function createSidebar() {
    if (sidebarEl && document.body.contains(sidebarEl)) return sidebarEl;

    const sidebar = document.createElement("div");
    sidebar.id = "sidekick-sidebar";

    sidebar.innerHTML = `
      <div class="sidekick-header">
        <span class="sidekick-title">Sidekick for SaaS</span>
      </div>
      <div class="sidekick-body">
        <p class="sidekick-instructions">
          1. Highlight a post's text.<br>
          2. Click "Use selected post".<br>
          3. Click "Generate comments".
        </p>
        <textarea id="sidekick-post-input" placeholder="Selected post text will appear here..."></textarea>
        <label class="sidekick-toggle">
          <input type="checkbox" id="sidekick-bridget-mode" checked />
          Rewrite like Bridget
        </label>
        <button id="sidekick-use-selection">Use selected post</button>
        <button id="sidekick-generate">Generate comments</button>
        <div id="sidekick-status"></div>
        <div id="sidekick-results"></div>
      </div>
    `;

    document.body.appendChild(sidebar);
    sidebarEl = sidebar;

    const useSelectionBtn = sidebar.querySelector("#sidekick-use-selection");
    const generateBtn = sidebar.querySelector("#sidekick-generate");

    useSelectionBtn.addEventListener("click", () => {
      const selectedText = getSelectedPostText();
      const textarea = sidebar.querySelector("#sidekick-post-input");
      if (selectedText) {
        textarea.value = selectedText;
        setStatus("Post text captured. Ready to generate.");
      } else {
        setStatus("Select a post's text first (highlight it), then click this button.");
      }
    });

    generateBtn.addEventListener("click", () => {
      const textarea = sidebar.querySelector("#sidekick-post-input");
      const text = textarea.value.trim();
      if (!text) {
        setStatus("Please paste or capture a post first.");
        return;
      }

      const bridgetModeCheckbox = sidebar.querySelector("#sidekick-bridget-mode");
      const bridgetMode = bridgetModeCheckbox ? bridgetModeCheckbox.checked : false;

      setStatus("Generating comments...");
      setResults("");

      chrome.runtime.sendMessage(
        { type: "GENERATE_COMMENTS", postText: text, bridgetMode },
        (response) => {
          if (chrome.runtime.lastError) {
            const msg = chrome.runtime.lastError.message || "Extension error.";
            setStatus(msg);
            console.error("Sidekick runtime error:", msg);
            return;
          }

          if (!response || !response.success) {
            const raw = response?.error || "Unknown error calling API.";
            const friendly = makeFriendlyError(raw);
            setStatus(friendly);
            console.error("Sidekick error:", raw);
            return;
          }

          setStatus("Comments generated.");
          renderComments(response.comments || []);
        }
      );
    });

    return sidebar;
  }

  function setStatus(msg) {
    if (!sidebarEl) return;
    const el = sidebarEl.querySelector("#sidekick-status");
    if (el) el.textContent = msg;
  }

  function setResults(html) {
    if (!sidebarEl) return;
    const el = sidebarEl.querySelector("#sidekick-results");
    if (el) el.innerHTML = html;
  }

  function renderComments(comments) {
    if (!sidebarEl) return;
    if (!comments.length) {
      setResults("<p>No comments returned.</p>");
      return;
    }
    const html = comments
      .map((c, i) => {
        const escaped = escapeHtml(c);
        const encoded = encodeURIComponent(c);
        return `
          <div class="sidekick-comment">
            <div class="sidekick-comment-index">Option ${i + 1}</div>
            <div class="sidekick-comment-text">${escaped}</div>
            <div class="sidekick-comment-actions">
              <button class="sidekick-copy-btn" data-comment="${encoded}">Copy</button>
              <button class="sidekick-insert-btn" data-comment="${encoded}">Insert</button>
            </div>
          </div>
        `;
      })
      .join("");

    setResults(html);

    sidebarEl
      .querySelectorAll(".sidekick-copy-btn")
      .forEach((btn) => {
        btn.addEventListener("click", () => {
          const comment = decodeURIComponent(
            btn.getAttribute("data-comment") || ""
          );
          navigator.clipboard.writeText(comment).then(
            () => setStatus("Copied to clipboard."),
            () => setStatus("Failed to copy.")
          );
        });
      });

    sidebarEl
      .querySelectorAll(".sidekick-insert-btn")
      .forEach((btn) => {
        btn.addEventListener("click", () => {
          const comment = decodeURIComponent(
            btn.getAttribute("data-comment") || ""
          );
          insertIntoReplyBox(comment);
        });
      });
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function getSelectedPostText() {
    const selection = window.getSelection();
    const text = selection ? selection.toString().trim() : "";
    return text || "";
  }

  function makeFriendlyError(raw) {
    const lower = String(raw).toLowerCase();

    if (
      lower.includes("insufficient_quota") ||
      lower.includes("you exceeded your current quota")
    ) {
      return "You’ve run out of OpenAI credits or hit your quota. Please check your OpenAI billing, add credit, then try again.";
    }

    if (
      lower.includes("model_not_found") ||
      lower.includes("does not exist or you do not have access")
    ) {
      return "The selected model is not available on your OpenAI account. Try switching to gpt-4o-mini in the settings.";
    }

    if (lower.includes("no api key set")) {
      return "No OpenAI API key is set. Open the Sidekick for SaaS options page and add your API key.";
    }

    if (lower.includes("network error")) {
      return "Network error calling OpenAI. Check your internet connection and try again.";
    }

    return raw;
  }

  function insertIntoReplyBox(text) {
    // X / Twitter reply composer (best effort)
    let el =
      document.querySelector('div[role="textbox"][data-testid="tweetTextarea_0"]') ||
      document.querySelector('div[role="textbox"][data-testid="tweetTextarea_1"]');

    // Fallback: focused contenteditable or any textbox
    if (!el) {
      el = document.activeElement;
      if (!(el && el.getAttribute && el.getAttribute("contenteditable") === "true")) {
        el = document.querySelector('div[contenteditable="true"][role="textbox"]');
      }
    }

    if (!el) {
      setStatus("Couldn't find the reply box. Try copying instead.");
      return;
    }

    el.focus();

    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
      el.value = text;
    } else {
      el.textContent = text;
    }

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);

    setStatus("Inserted into reply box.");
  }

  // Listen for popup toggle
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "TOGGLE_SIDEBAR") {
      toggleSidebar();
    }
  });

  function toggleSidebar() {
    if (!sidebarEl || !document.body.contains(sidebarEl)) {
      createSidebar();
      return;
    }

    if (sidebarEl.style.display === "none") {
      sidebarEl.style.display = "";
    } else {
      sidebarEl.style.display = "none";
    }
  }
})();
