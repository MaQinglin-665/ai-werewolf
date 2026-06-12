export default class OrdinaryAiJudgeProvider {
  id() {
    return "ordinary-ai-judge";
  }

  async callApi(prompt) {
    const apiKey = process.env.PROMPTFOO_JUDGE_API_KEY;
    if (!apiKey) {
      return {
        error: "PROMPTFOO_JUDGE_API_KEY is not configured. Skipping live ordinary AI judge call.",
      };
    }

    const baseUrl = String(process.env.PROMPTFOO_JUDGE_BASE_URL ?? "https://api.openai.com/v1").replace(/\/+$/, "");
    const model = String(process.env.PROMPTFOO_JUDGE_MODEL ?? "gpt-4o-mini");
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: "You are a strict JSON-only evaluator for Chinese Werewolf game AI output.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0,
      }),
    });

    const text = await response.text();
    if (!response.ok) {
      return {
        error: `Judge request failed with HTTP ${response.status}: ${clip(text, 500)}`,
      };
    }

    const data = JSON.parse(text);
    return {
      output: data.choices?.[0]?.message?.content ?? "",
      tokenUsage: data.usage,
    };
  }
}

function clip(value, limit) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length <= limit ? text : text.slice(0, limit);
}
