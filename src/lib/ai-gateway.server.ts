import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export function createGateway(key: string) {
  return createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": key,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });
}

export const DEFAULT_MODEL = "google/gemini-3-flash-preview";