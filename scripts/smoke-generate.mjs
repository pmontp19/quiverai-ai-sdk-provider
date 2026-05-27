// One-shot smoke test against the live QuiverAI API.
// Uses the provider's LanguageModel doGenerate directly — no `ai` package required.
import { createQuiverAI } from "../dist/index.mjs";

const apiKey = process.env.QUIVER_API_KEY;
if (!apiKey) {
  console.error("QUIVER_API_KEY is not set");
  process.exit(1);
}

const quiverai = createQuiverAI({ apiKey });
const model = quiverai("arrow-1.1");

const start = Date.now();
const result = await model.doGenerate({
  prompt: [
    {
      role: "user",
      content: [{ type: "text", text: "A red circle with a blue border" }],
    },
  ],
  providerOptions: {},
});
const elapsed = Date.now() - start;

const svg = result.content.find((c) => c.type === "text")?.text ?? "";
console.log(`model: ${result.response?.modelId}`);
console.log(`response id: ${result.response?.id}`);
console.log(`finish: ${JSON.stringify(result.finishReason)}`);
console.log(`providerMetadata: ${JSON.stringify(result.providerMetadata)}`);
console.log(`warnings: ${JSON.stringify(result.warnings)}`);
console.log(`elapsed: ${elapsed}ms`);
console.log(`svg length: ${svg.length} chars`);
console.log(`svg preview: ${svg.slice(0, 160)}${svg.length > 160 ? "…" : ""}`);
