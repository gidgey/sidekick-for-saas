// options.js

document.addEventListener("DOMContentLoaded", restoreOptions);
document.getElementById("save").addEventListener("click", saveOptions);

function saveOptions() {
  const apiKey = document.getElementById("apiKey").value.trim();
  const model = document.getElementById("model").value.trim();
  const tone = document.getElementById("tone").value.trim();
  const count = parseInt(document.getElementById("count").value.trim(), 10) || 3;

  chrome.storage.sync.set(
    {
      apiKey,
      model,
      tone,
      count
    },
    () => {
      const status = document.getElementById("status");
      status.textContent = "Settings saved.";
      setTimeout(() => (status.textContent = ""), 2000);
    }
  );
}

function restoreOptions() {
  chrome.storage.sync.get(
    {
      apiKey: "",
      model: "gpt-4.1-mini",
      tone: "helpful, practical, slightly witty, focused on SaaS founders",
      count: 3
    },
    (items) => {
      document.getElementById("apiKey").value = items.apiKey;
      document.getElementById("model").value = items.model;
      document.getElementById("tone").value = items.tone;
      document.getElementById("count").value = items.count;
    }
  );
}
