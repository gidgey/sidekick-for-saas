// options.js

document.addEventListener("DOMContentLoaded", () => {
  restoreOptions();

  document.getElementById("save").addEventListener("click", saveOptions);
  document
    .getElementById("testConnection")
    .addEventListener("click", testConnection);
});

function saveOptions() {
  const apiKey = document.getElementById("apiKey").value.trim();
  const model = document.getElementById("model").value;
  const tone = document.getElementById("tone").value.trim();
  const count =
    parseInt(document.getElementById("count").value.trim(), 10) || 3;

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
      setTimeout(() => {
        status.textContent = "";
      }, 2000);
    }
  );
}

function restoreOptions() {
  chrome.storage.sync.get(
    {
      apiKey: "",
      model: "gpt-4o-mini",
      tone:
        "helpful, practical, slightly witty, focused on SaaS founders",
      count: 3
    },
    (items) => {
      document.getElementById("apiKey").value = items.apiKey || "";

      const modelSelect = document.getElementById("model");
      if (
        items.model &&
        modelSelect.querySelector(`option[value="${items.model}"]`)
      ) {
        modelSelect.value = items.model;
      } else {
        modelSelect.value = "gpt-4o-mini";
      }

      document.getElementById("tone").value = items.tone || "";
      document.getElementById("count").value = items.count || 3;
    }
  );
}

function testConnection() {
  const testStatus = document.getElementById("testStatus");
  testStatus.textContent = "Testing connection…";
  testStatus.className = "";

  const apiKey = document.getElementById("apiKey").value.trim();
  const model = document.getElementById("model").value;

  if (!apiKey) {
    testStatus.textContent =
      "Please enter your OpenAI API key above before testing.";
    testStatus.className = "error";
    return;
  }

  chrome.runtime.sendMessage(
    {
      type: "TEST_CONNECTION",
      apiKey,
      model
    },
    (response) => {
      if (chrome.runtime.lastError) {
        const msg = chrome.runtime.lastError.message || "Unknown extension error.";
        testStatus.textContent = `Extension error: ${msg}`;
        testStatus.className = "error";
        console.error("Test connection runtime error:", msg);
        return;
      }

      if (!response) {
        const msg = "No response from background script.";
        testStatus.textContent = msg;
        testStatus.className = "error";
        console.error("Test connection error:", msg);
        return;
      }

      if (!response.success) {
        const msg = response.error || "Unknown error testing connection.";
        testStatus.textContent = makeFriendlyTestError(msg);
        testStatus.className = "error";
        console.error("Test connection error:", msg);
        return;
      }

      const text =
        response.message ||
        `Connection successful using model ${response.modelUsed}.`;
      testStatus.textContent = text;
      testStatus.className = "success";
    }
  );
}

function makeFriendlyTestError(raw) {
  const lower = String(raw).toLowerCase();

  if (
    lower.includes("insufficient_quota") ||
    lower.includes("you exceeded your current quota")
  ) {
    return "Connected, but your OpenAI account is out of credits or quota. Add credit in your OpenAI billing, then try again.";
  }

  if (
    lower.includes("model_not_found") ||
    lower.includes("does not exist or you do not have access")
  ) {
    return "The selected model is not available on your OpenAI account. Try switching to gpt-4o-mini.";
  }

  if (lower.includes("no api key")) {
    return "No API key provided. Enter your OpenAI API key and try again.";
  }

  if (lower.includes("network error")) {
    return "Network error calling OpenAI. Check your internet connection and try again.";
  }

  if (lower.includes("openai api error")) {
    return raw;
  }

  return raw;
}
