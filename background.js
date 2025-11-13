// background.js

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GENERATE_COMMENTS") {
    handleGenerateComments(message.postText)
      .then((result) => sendResponse({ success: true, comments: result }))
      .catch((err) => {
        console.error("Error generating comments:", err);
        sendResponse({ success: false, error: err.message || String(err) });
      });

    // Keep the message channel open for async response
    return true;
  }
});

async function handleGenerateComments(postText) {
  const config = await getConfig();

  if (!config.apiKey) {
    throw new Error("No API key set. Go to the extension options page to save one.");
  }

  const tone = config.tone || "helpful, friendly, SaaS-savvy";
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
`;

  const body = {
    model,
    messages: [
      { role: "system", content: "You help write smart, authentic comments for SaaS founders' posts." },
      { role: "user", content: prompt }
    ],
    temperature: 0.8
  };

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${config.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("OpenAI API error:", text);
    // Pass the actual error text up so we can display it
    throw new Error(`OpenAI API error: ${text}`);
  }

  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content || "";
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line);

  const comments = lines
    .map((line) => line.replace(/^\d+[\).\s-]*/,"").trim())
    .filter((line) => line.length > 0)
    .slice(0, count);

  return comments;
}

function getConfig() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      {
        apiKey: "",
        model: "gpt-4.1-mini",
        tone: "helpful, practical, slightly witty, focused on SaaS founders",
        count: 3
      },
      resolve
    );
  });
}
