// Two smoke tests:
//   1. Invalid model ID → expect 404 model_not_found
//   2. arrow-1.1-max with n=2 via the image model → expect 2 SVGs back
import { APICallError } from "@ai-sdk/provider";
import { createQuiverAI } from "../dist/index.mjs";

const apiKey = process.env.QUIVER_API_KEY;
if (!apiKey) {
  console.error("QUIVER_API_KEY is not set");
  process.exit(1);
}

const quiverai = createQuiverAI({ apiKey });

// ---- Test 1: invalid model ----
console.log("=== Test 1: invalid model ===");
try {
  const badModel = quiverai("arrow-does-not-exist");
  await badModel.doGenerate({
    prompt: [
      { role: "user", content: [{ type: "text", text: "hello" }] },
    ],
    providerOptions: {},
  });
  console.log("UNEXPECTED: call succeeded");
} catch (err) {
  if (APICallError.isInstance(err)) {
    console.log(`statusCode: ${err.statusCode}`);
    console.log(`isRetryable: ${err.isRetryable}`);
    console.log(`message: ${err.message}`);
    console.log(`data.code: ${err.data?.code}`);
    console.log(`data.request_id: ${err.data?.request_id}`);
  } else {
    console.log("non-APICallError:", err);
  }
}

// ---- Test 2: arrow-1.1-max with n=2 ----
console.log("\n=== Test 2: arrow-1.1-max n=2 (image model) ===");
const imageModel = quiverai.image("arrow-1.1-max");
console.log(`maxImagesPerCall: ${imageModel.maxImagesPerCall}`);

const start = Date.now();
const result = await imageModel.doGenerate({
  prompt: "Two minimalist coffee cup icons, flat monochrome",
  n: 2,
  size: undefined,
  aspectRatio: undefined,
  seed: undefined,
  files: undefined,
  mask: undefined,
  providerOptions: {},
});
const elapsed = Date.now() - start;

console.log(`elapsed: ${elapsed}ms`);
console.log(`images returned: ${result.images.length}`);
console.log(`warnings: ${JSON.stringify(result.warnings)}`);
console.log(`providerMetadata: ${JSON.stringify(result.providerMetadata)}`);
const decoder = new TextDecoder();
result.images.forEach((img, i) => {
  const svg = decoder.decode(img);
  console.log(`image[${i}] length: ${svg.length}`);
  console.log(`image[${i}] starts: ${svg.slice(0, 80)}…`);
});
