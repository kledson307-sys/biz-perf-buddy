import { createOpenAI } from "@ai-sdk/openai";
import { streamText, type ModelMessage } from "ai";

import { createLovableAiGatewayRunIdFetch, getLovableAiGatewayRunId } from "./run-id.server.ts";

export const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";
export const DEFAULT_MODEL = "openai/gpt-6-astra";

/** Streams a Responses call through Lovable AI Gateway and returns the final text. */
export async function gatewayText(
  request: Request | undefined,
  config: { apiKey: string; model?: string; effort?: "low" | "medium" },
  messages: ModelMessage[],
  instructions?: string,
) {
  const runIdFetch = createLovableAiGatewayRunIdFetch(request ? getLovableAiGatewayRunId(request) : undefined);
  const provider = createOpenAI({
    baseURL: GATEWAY_URL,
    apiKey: config.apiKey,
    headers: { "Lovable-API-Key": config.apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });
  let streamError: unknown;
  const result = streamText({
    model: provider.responses(config.model ?? DEFAULT_MODEL),
    ...(instructions ? { instructions } : {}),
    messages,
    ...(request?.signal ? { abortSignal: request.signal } : {}),
    onError: ({ error }) => { streamError = error; },
    providerOptions: {
      openai: {
        store: false,
        forceReasoning: true,
        reasoningEffort: config.effort ?? "low",
        reasoningSummary: "auto",
        include: ["reasoning.encrypted_content"],
      },
    },
  });
  const text = await result.text;
  if (streamError) throw streamError;
  return text;
}
