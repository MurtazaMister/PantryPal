import type { UserMemorySummary } from "./types";

export async function enrichPromptWithOpenAI(params: {
  apiKey?: string;
  model: string;
  memory: UserMemorySummary;
  prompt: string;
}) {
  if (!params.apiKey || !params.prompt.trim()) {
    return null;
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model: params.model,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "Summarize the user's recipe intent into a short structured sentence using their memory profile. Keep it under 60 words.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify({
                prompt: params.prompt,
                memory: params.memory,
              }),
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as {
    output_text?: string;
  };

  return data.output_text ?? null;
}

export async function estimateExpiryWithOpenAI(params: {
  apiKey?: string;
  model: string;
  itemName: string;
  unit: string;
  purchasedDate: string;
}) {
  if (!params.apiKey) {
    return null;
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model: params.model,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "Estimate pantry item shelf life in whole days from purchase date. Return strict JSON only: {\"shelfLifeDays\": number, \"confidence\": number, \"reason\": string}.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify({
                itemName: params.itemName,
                unit: params.unit,
                purchasedDate: params.purchasedDate,
              }),
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as {
    output_text?: string;
  };

  if (!data.output_text) {
    return null;
  }

  try {
    const parsed = JSON.parse(data.output_text) as {
      shelfLifeDays?: number;
      confidence?: number;
      reason?: string;
    };
    if (!parsed.shelfLifeDays || parsed.shelfLifeDays <= 0) {
      return null;
    }
    return {
      shelfLifeDays: Math.round(parsed.shelfLifeDays),
      confidence: typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5,
      reason: parsed.reason ?? "Estimated by model.",
    };
  } catch {
    return null;
  }
}
