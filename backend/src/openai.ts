import type { UserMemorySummary } from "./types";
import {
  deductionEstimateJsonSchema,
  deductionEstimateOutputSchema,
  expiryEstimateJsonSchema,
  expiryEstimateOutputSchema,
  recipeChatJsonSchema,
  recipeChatOutputSchema,
  recipeFinalizeJsonSchema,
  recipeFinalizeOutputSchema,
  recipeSummaryJsonSchema,
  recipeSummaryOutputSchema,
} from "./aiContracts";
import type { z } from "zod";

type ResponseApiJson = {
  output_parsed?: unknown;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
      json?: unknown;
    }>;
  }>;
};

async function callStrictJson<T>(params: {
  apiKey?: string;
  model: string;
  routeTag:
    | "estimate-expiry"
    | "recipe-query"
    | "deduction-estimate"
    | "recipe-chat"
    | "recipe-finalize";
  schemaName: string;
  schema: Record<string, unknown>;
  validator: z.ZodType<T>;
  systemText: string;
  inputPayload: unknown;
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
    return null;
  }

  const data = (await response.json()) as ResponseApiJson;
  const raw =
    data.output_parsed ??
    data.output?.flatMap((block) => block.content ?? []).find((entry) => entry.json)?.json ??
    data.output?.flatMap((block) => block.content ?? []).find((entry) => typeof entry.text === "string")?.text;

  if (!raw) {
    return null;
  }

  let candidate: unknown = raw;
  if (typeof raw === "string") {
    try {
      candidate = JSON.parse(raw);
    } catch {
      return null;
    }
  }

  const parsed = params.validator.safeParse(candidate);
  if (!parsed.success) {
    return null;
  }
  return parsed.data;
}

export async function enrichPromptWithOpenAI(params: {
  apiKey?: string;
  model: string;
  memory: UserMemorySummary;
  prompt: string;
}) {
  if (!params.apiKey || !params.prompt.trim()) {
    return null;
  }

  const parsed = await callStrictJson({
    apiKey: params.apiKey,
    model: params.model,
    routeTag: "recipe-query",
    schemaName: "recipe_query_summary",
    schema: recipeSummaryJsonSchema,
    validator: recipeSummaryOutputSchema,
    systemText:
      "Summarize the user's recipe intent into one short sentence. Return strict JSON with key `summary` only.",
    inputPayload: {
      prompt: params.prompt,
      memory: params.memory,
    },
  });
  return parsed?.summary ?? null;
}

export async function estimateExpiryWithOpenAI(params: {
  apiKey?: string;
  model: string;
  itemName: string;
  unit: string;
  purchasedDate: string;
}) {
  return callStrictJson({
    apiKey: params.apiKey,
    model: params.model,
    routeTag: "estimate-expiry",
    schemaName: "expiry_estimate",
    schema: expiryEstimateJsonSchema,
    validator: expiryEstimateOutputSchema,
    systemText:
      "Estimate pantry item shelf life in whole days from purchased date. Return strict JSON only.",
    inputPayload: {
      itemName: params.itemName,
      unit: params.unit,
      purchasedDate: params.purchasedDate,
    },
  });
}

export async function estimateDeductionWithOpenAI(params: {
  apiKey?: string;
  model: string;
  pantry: Array<{ id: string; name: string; normalizedName: string; quantity: number; unit: string }>;
  servings: number;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  recipeId?: string;
  description?: string;
}) {
  return callStrictJson({
    apiKey: params.apiKey,
    model: params.model,
    routeTag: "deduction-estimate",
    schemaName: "deduction_estimate",
    schema: deductionEstimateJsonSchema,
    validator: deductionEstimateOutputSchema,
    systemText:
      "Estimate ingredient deductions from pantry items. Return strict JSON only with meal_name, servings, deductions, unmatched_ingredients.",
    inputPayload: params,
  });
}

export async function recipeChatWithOpenAI(params: {
  apiKey?: string;
  model: string;
  pantry: Array<{ id: string; name: string; normalizedName: string; quantity: number; unit: string }>;
  recipeSnapshot: {
    title: string;
    cuisine: string;
    cookingTimeMinutes: number;
    equipment: Array<"stove" | "oven" | "microwave" | "grill" | "none">;
    servings: number;
    ingredients: Array<{ name: string; normalizedName: string; quantity: number; unit: string }>;
    steps: string[];
  };
  chatHistory: Array<{ role: "user" | "assistant"; text: string }>;
  message: string;
}) {
  return callStrictJson({
    apiKey: params.apiKey,
    model: params.model,
    routeTag: "recipe-chat",
    schemaName: "recipe_chat_turn",
    schema: recipeChatJsonSchema,
    validator: recipeChatOutputSchema,
    systemText:
      "You are a cooking assistant. You may fully rewrite the recipe. Return strict JSON with assistantMessage and recipeSnapshot only.",
    inputPayload: params,
  });
}

export async function recipeFinalizeWithOpenAI(params: {
  apiKey?: string;
  model: string;
  pantry: Array<{ id: string; name: string; normalizedName: string; quantity: number; unit: string }>;
  recipeSnapshot: {
    title: string;
    cuisine: string;
    cookingTimeMinutes: number;
    equipment: Array<"stove" | "oven" | "microwave" | "grill" | "none">;
    servings: number;
    ingredients: Array<{ name: string; normalizedName: string; quantity: number; unit: string }>;
    steps: string[];
  };
  chatHistory: Array<{ role: "user" | "assistant"; text: string }>;
}) {
  return callStrictJson({
    apiKey: params.apiKey,
    model: params.model,
    routeTag: "recipe-finalize",
    schemaName: "recipe_finalize",
    schema: recipeFinalizeJsonSchema,
    validator: recipeFinalizeOutputSchema,
    systemText:
      "Infer the final agreed recipe from conversation and estimate pantry deductions. Return strict JSON only.",
    inputPayload: params,
  });
}
