// background.js (service worker)

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GENERATE_COMMENTS") {
    handleGenerateComments(message.postText, !!message.bridgetMode)
      .then((result) => sendResponse({ success: true, comments: result }))
      .catch((err) => {
        console.error("Error generating comments:", err);
        sendResponse({ success: false, error: err.message || String(err) });
      });

    return true; // async
  }

  if (message.type === "TEST_CONNECTION") {
    handleTestConnection(message.apiKey, message.model)
      .then((result) => sendResponse({ success: true, ...result }))
      .catch((err) => {
        console.error("Test connection error:", err);
        sendResponse({ success: false, error: err.message || String(err) });
      });

    return true; // async
  }
});

async function handleGenerateComments(postText, bridgetMode) {
  const config = await getConfig();

  if (!config.apiKey) {
    throw new Error("No API key set. Open the extension options and add your OpenAI API key.");
  }

  let tone =
    config.tone ||
    "helpful, practical, slightly witty, focused on SaaS founders";

  if (bridgetMode) {
    tone =
      "Bridget Willard's tone: warm, direct, slightly witty, practical, with clear takeaways for SaaS founders. Avoid jargon. Sound like a seasoned marketing consultant who actually does the work.";
  }

  const count = config.count || 3;
  const model = config.model || "gpt-4o-mini";

  const prompt = `
You are helping a SaaS marketing consultant write thoughtful, concise comments on social posts by SaaS founders.

Tone: ${tone}

Post content:
"""${postText}"""

Generate ${count} distinct, short comment options (1–2 sentences each), numbered 1, 2, 3.
They should:
- Add value
- Sound human, not salesy
- NOT pitch services directly
- Be relevant to the post.

Return ONLY the comments, numbered.
  `.trim();

  const body = {
    model,
    messages: [
      {
        role: "system",
        content:
          "You help write smart, authentic comments for SaaS founders' posts."
      },
      { role: "user", content: prompt }
    ],
    temperature: 0.8
  };

  const response = await safeFetchOpenAI(config.apiKey, body);

  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content || "";
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const comments = lines
    .map((line) => line.replace(/^\d+[\).\s-]*/,"").trim())
    .filter((line) => line.length > 0)
    .slice(0, count);

  if (!comments.length) {
    throw new Error("No comments were returned by the model.");
  }

  return comments;
}

// Tiny, cheap test call for the "Test connection" button
async function handleTestConnection(apiKeyOverride, modelOverride) {
  const config = await getConfig();

  const apiKey = apiKeyOverride || config.apiKey;
  const model = modelOverride || config.model || "gpt-4o-mini";

  if (!apiKey) {
    throw new Error("No API key provided. Enter your key in the form first.");
  }

  const body = {
    model,
    messages: [
      {
        role: "system",
        content: "You respond briefly with 'OK' for test requests."
      },
      { role: "user", content: "Say OK." }
    ],
    max_tokens: 3,
    temperature: 0
  };

  const response = await safeFetchOpenAI(apiKey, body);
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";

  return {
    message: content.trim() || "Connection successful.",
    modelUsed: model
  };
}

// Shared OpenAI fetch
async function safeFetchOpenAI(apiKey, body) {
  let response;
  try {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
  } catch (networkErr) {
    console.error("Network error calling OpenAI:", networkErr);
    throw new Error(
      "Network error calling OpenAI. Check your internet connection and try again."
    );
  }

  if (!response.ok) {
    const text = await response.text();
    console.error("OpenAI API error:", text);
    throw new Error(`OpenAI API error: ${text}`);
  }

  return response;
}

function getConfig() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      {
        apiKey: "",
        model: "gpt-4o-mini",
        tone:
          "helpful, practical, slightly witty, focused on SaaS founders",
        count: 3
      },
      resolve
    );
  });
}
