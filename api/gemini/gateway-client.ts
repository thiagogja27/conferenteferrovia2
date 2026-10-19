import { generateText, gateway } from "ai";

type GenerateContentRequest = {
  model: string;
  contents: string;
  config?: {
    systemInstruction?: string;
    responseMimeType?: string;
    responseSchema?: unknown;
  };
};

const MODEL_ALIASES: Record<string, string> = {
  "gemini-2.5-flash": "google/gemini-2.5-flash",
  "gemini-3.8-flash": "google/gemini-3.8-flash",
};

export function getGatewayAI() {
  return {
    models: {
      async generateContent({ model, contents, config }: GenerateContentRequest) {
        const result = await generateText({
          model: gateway(MODEL_ALIASES[model] ?? (model.includes("/") ? model : `google/${model}`)),
          system: config?.systemInstruction,
          prompt: contents,
        });

        return { text: result.text };
      },
    },
  };
}
