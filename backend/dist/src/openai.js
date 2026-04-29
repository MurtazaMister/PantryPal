"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enrichPromptWithOpenAI = enrichPromptWithOpenAI;
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
        return null;
    }
    const data = (await response.json());
    return data.output_text ?? null;
}
