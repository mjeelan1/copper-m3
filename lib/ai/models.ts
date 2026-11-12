// The course's approved models. Calls go straight to Google with a Google AI
// Studio key, which is free and needs no credit card.
export const MODELS = [
  {
    id: "google/gemini-2.5-flash",
    label: "Gemini 2.5 Flash (fast, shows its thinking)",
    // Google's own name for it, used when calling Google.
    googleId: "gemini-2.5-flash",
  },
  {
    id: "google/gemini-3-flash",
    label: "Gemini 3 Flash (newer, thinks out loud less often)",
    googleId: "gemini-3-flash-preview",
  },
  {
    id: "google/gemini-3.5-flash-lite",
    label: "Gemini 3.5 Flash-Lite (works with new AI Studio keys)",
    googleId: "gemini-3.5-flash-lite",
    // Google only serves this model to new keys through its Interactions API
    // (POST /v1beta/interactions), not :generateContent. See languageModel()
    // in lib/ai/call.ts.
    api: "interactions",
  },
] as const;

export type ModelId = (typeof MODELS)[number]["id"];

/**
 * The model used when a call doesn't name one. Since 2026-11 Google refuses
 * gemini-2.5-flash and gemini-3-flash-preview for new users ("no longer
 * available to new users"), so the default is 3.5 Flash-Lite. It answers and
 * uses tools but sends no thinking summaries, so Ask Copper shows no
 * "thinking" step. Set AI_MODEL to pick another approved model.
 */
export const DEFAULT_MODEL: ModelId = "google/gemini-3.5-flash-lite";

/** AI_MODEL if it names an approved model, otherwise the default. */
export function defaultModel(): ModelId {
  const id = process.env.AI_MODEL;
  return MODELS.find((m) => m.id === id)?.id ?? DEFAULT_MODEL;
}
