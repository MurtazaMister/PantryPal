"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enrichPromptWithOpenAI = enrichPromptWithOpenAI;
exports.estimateExpiryWithOpenAI = estimateExpiryWithOpenAI;
async function enrichPromptWithOpenAI(params) {
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
                            text: "Summarize the user's recipe intent into a short structured sentence using their memory profile. Keep it under 60 words.",
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
        console.log(`dev:ai estimate-expiry openai-http-fail status=${response.status}`);
        return null;
    }
    const data = (await response.json());
    return data.output_text ?? null;
}
async function estimateExpiryWithOpenAI(params) {
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
                            text: "Estimate pantry item shelf life in whole days from purchase date. Return strict JSON only: {\"shelfLifeDays\": number, \"confidence\": number, \"reason\": string}.",
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
    const data = (await response.json());
    if (!data.output_text) {
        console.log("dev:ai estimate-expiry empty-output-text");
        return null;
    }
    try {
        const parsed = JSON.parse(data.output_text);
        if (!parsed.shelfLifeDays || parsed.shelfLifeDays <= 0) {
            console.log("dev:ai estimate-expiry invalid-shelfLifeDays");
            return null;
        }
        return {
            shelfLifeDays: Math.round(parsed.shelfLifeDays),
            confidence: typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5,
            reason: parsed.reason ?? "Estimated by model.",
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "parse error";
        console.log(`dev:ai estimate-expiry parse-fail message=${message}`);
        return null;
    }
}
