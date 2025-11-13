// contentScript.js

(function () {
  // Avoid injecting multiple times
  if (window.__sidekickInjected) return;
  window.__sidekickInjected = true;

  createSidebar();

  function createSidebar() {
    const sidebar = document.createElement("div");
    sidebar.id = "sidekick-sidebar";

    sidebar.innerHTML = `
      <div class="sidekick-header">
        <span class="sidekick-title">Sidekick for SaaS</span>
      </div>
      <div class="sidekick-body">
        <p class="sidekick-instructions">
          1. Click on a post.<br>
          2. Click "Use selected post".<br>
          3. Generate comments.
        </p>
        <textarea id="sidekick-post-input" placeholder="Selected post text will appear here..."></textarea>
        <button id="sidekick-use-selection">Use selected post</button>
        <button id="sidekick-generate">Generate comments</button>
        <div id="sidekick-status"></div>
        <div id="sidekick-results"></div>
      </div>
    `;

    document.body.appendChild(sidebar);

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

      setStatus("Generating comments...");
      setResults("");

      chrome.runtime.sendMessage(
        { type: "GENERATE_COMMENTS", postText: text },
        (response) => {
          if (!response || !response.success) {
            setStatus("Error generating comments. Check console and API key.");
            console.error(response?.error);
            return;
          }

          setStatus("Comments generated.");
          renderComments(response.comments || []);
        }
      );
    });

    function setStatus(msg) {
      const el = sidebar.querySelector("#sidekick-status");
      if (el) el.textContent = msg;
    }

    function setResults(html) {
      const el = sidebar.querySelector("#sidekick-results");
      if (el) el.innerHTML = html;
    }

    function renderComments(comments) {
      if (!comments.length) {
        setResults("<p>No comments returned.</p>");
        return;
      }
      const html = comments
        .map((c, i) => {
          const escaped = escapeHtml(c);
          return `
            <div class="sidekick-comment">
              <div class="sidekick-comment-index">Option ${i + 1}</div>
              <div class="sidekick-comment-text">${escaped}</div>
              <button class="sidekick-copy-btn" data-comment="${encodeURIComponent(
                c
              )}">Copy</button>
            </div>
          `;
        })
        .join("");

      setResults(html);

      document
        .querySelectorAll(".sidekick-copy-btn")
        .forEach((btn) => {
          btn.addEventListener("click", () => {
            const comment = decodeURIComponent(btn.getAttribute("data-comment") || "");
            navigator.clipboard.writeText(comment).then(
              () => setStatus("Copied to clipboard."),
              () => setStatus("Failed to copy.")
            );
          });
        });
    }

    function escapeHtml(str) {
      return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    }
  }

  function getSelectedPostText() {
    const selection = window.getSelection();
    const text = selection ? selection.toString().trim() : "";
    return text || "";
  }
})();
