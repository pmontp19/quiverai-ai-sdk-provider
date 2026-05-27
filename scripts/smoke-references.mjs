// Smoke test for the references (text + image → guided SVG) feature.
import { createQuiverAI } from "../dist/index.mjs";

const apiKey = process.env.QUIVER_API_KEY;
if (!apiKey) {
  console.error("QUIVER_API_KEY is not set");
  process.exit(1);
}

const quiverai = createQuiverAI({ apiKey });
const model = quiverai("arrow-1.1");

// 1x1 red PNG (from the OpenAPI example) — inlined so we don't depend on
// Quiver's server-side URL fetcher reaching an external host.
const referenceBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

const start = Date.now();
const result = await model.doGenerate({
  prompt: [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: "A minimalist flat-style logo inspired by this reference",
        },
        {
          type: "file",
          data: referenceBase64,
          mediaType: "image/png",
        },
      ],
    },
  ],
  providerOptions: {},
});
const elapsed = Date.now() - start;

const svg = result.content.find((c) => c.type === "text")?.text ?? "";
console.log(`model: ${result.response?.modelId}`);
console.log(`response id: ${result.response?.id}`);
console.log(`providerMetadata: ${JSON.stringify(result.providerMetadata)}`);
console.log(`warnings: ${JSON.stringify(result.warnings)}`);
console.log(`elapsed: ${elapsed}ms`);
console.log(`svg length: ${svg.length} chars`);
console.log(`svg preview: ${svg.slice(0, 200)}${svg.length > 200 ? "…" : ""}`);
