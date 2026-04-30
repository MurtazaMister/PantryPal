"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enrichPromptWithOpenAI = enrichPromptWithOpenAI;
exports.estimateExpiryWithOpenAI = estimateExpiryWithOpenAI;
exports.estimateDeductionWithOpenAI = estimateDeductionWithOpenAI;
exports.recipeChatWithOpenAI = recipeChatWithOpenAI;
exports.recipeFinalizeWithOpenAI = recipeFinalizeWithOpenAI;
const aiContracts_1 = require("./aiContracts");
async function callStrictJson(params) {
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
                    content: [{ type: "input_text", text: params.systemText }],
                },
                {
                    role: "user",
                    content: [{ type: "input_text", text: JSON.stringify(params.inputPayload) }],
                },
            ],
            text: {
                format: {
                    type: "json_schema",
                    name: params.schemaName,
                    strict: true,
                    schema: params.schema,
                },
            },
        }),
    });
    if (!response.ok) {
        console.log(`dev:ai ${params.routeTag} openai-http-fail status=${response.status}`);
        return null;
    }
    const data = (await response.json());
    const raw = data.output_parsed ??
        data.output?.flatMap((block) => block.content ?? []).find((entry) => entry.json)?.json ??
        data.output?.flatMap((block) => block.content ?? []).find((entry) => typeof entry.text === "string")?.text;
    if (!raw) {
        console.log(`dev:ai ${params.routeTag} empty-structured-output`);
        return null;
    }
    let candidate = raw;
    if (typeof raw === "string") {
        try {
            candidate = JSON.parse(raw);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "json-parse-fail";
            console.log(`dev:ai ${params.routeTag} schema-fail reason=${message}`);
            return null;
        }
    }
    const parsed = params.validator.safeParse(candidate);
    if (!parsed.success) {
        console.log(`dev:ai ${params.routeTag} schema-fail issue=${parsed.error.issues[0]?.path.join(".") ?? "unknown"}`);
        return null;
    }
    console.log(`dev:ai ${params.routeTag} schema-pass`);
    return parsed.data;
}
async function enrichPromptWithOpenAI(params) {
    if (!params.apiKey || !params.prompt.trim()) {
        return null;
    }
    const parsed = await callStrictJson({
        apiKey: params.apiKey,
        model: params.model,
        routeTag: "recipe-query",
        schemaName: "recipe_query_summary",
        schema: aiContracts_1.recipeSummaryJsonSchema,
        validator: aiContracts_1.recipeSummaryOutputSchema,
        systemText: "Summarize the user's recipe intent into one short sentence. Return strict JSON with key `summary` only.",
        inputPayload: {
            prompt: params.prompt,
            memory: params.memory,
        },
    });
    return parsed?.summary ?? null;
}
async function estimateExpiryWithOpenAI(params) {
    return callStrictJson({
        apiKey: params.apiKey,
        model: params.model,
        routeTag: "estimate-expiry",
        schemaName: "expiry_estimate",
        schema: aiContracts_1.expiryEstimateJsonSchema,
        validator: aiContracts_1.expiryEstimateOutputSchema,
        systemText: "Estimate pantry item shelf life in whole days from purchased date. Return strict JSON only.",
        inputPayload: {
            itemName: params.itemName,
            unit: params.unit,
            purchasedDate: params.purchasedDate,
        },
    });
}
async function estimateDeductionWithOpenAI(params) {
    return callStrictJson({
        apiKey: params.apiKey,
        model: params.model,
        routeTag: "deduction-estimate",
        schemaName: "deduction_estimate",
        schema: aiContracts_1.deductionEstimateJsonSchema,
        validator: aiContracts_1.deductionEstimateOutputSchema,
        systemText: "Estimate ingredient deductions from pantry items. Return strict JSON only with meal_name, servings, deductions, unmatched_ingredients.",
        inputPayload: params,
    });
}
async function recipeChatWithOpenAI(params) {
    return callStrictJson({
        apiKey: params.apiKey,
        model: params.model,
        routeTag: "recipe-chat",
        schemaName: "recipe_chat_turn",
        schema: aiContracts_1.recipeChatJsonSchema,
        validator: aiContracts_1.recipeChatOutputSchema,
        systemText: "You are a cooking assistant. You may fully rewrite the recipe. Return strict JSON with assistantMessage and recipeSnapshot only.",
        inputPayload: params,
    });
}
async function recipeFinalizeWithOpenAI(params) {
    return callStrictJson({
        apiKey: params.apiKey,
        model: params.model,
        routeTag: "recipe-finalize",
        schemaName: "recipe_finalize",
        schema: aiContracts_1.recipeFinalizeJsonSchema,
        validator: aiContracts_1.recipeFinalizeOutputSchema,
        systemText: "Infer the final agreed recipe from conversation and estimate pantry deductions. Return strict JSON only.",
        inputPayload: params,
    });
}
