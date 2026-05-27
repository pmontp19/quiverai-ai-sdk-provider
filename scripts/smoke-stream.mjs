// Smoke test for the streaming path against the live QuiverAI API.
import { createQuiverAI } from "../dist/index.mjs";

const apiKey = process.env.QUIVER_API_KEY;
if (!apiKey) {
  console.error("QUIVER_API_KEY is not set");
  process.exit(1);
}

const quiverai = createQuiverAI({ apiKey });
const model = quiverai("arrow-1.1");

const start = Date.now();
const { stream } = await model.doStream({
  prompt: [
    {
      role: "user",
      content: [{ type: "text", text: "A minimalist blue star icon" }],
    },
  ],
  providerOptions: {},
});

const counts = new Map();
let textChars = 0;
let reasoningChars = 0;
let finishEvent;
let responseMetadata;

const reader = stream.getReader();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  counts.set(value.type, (counts.get(value.type) ?? 0) + 1);
  if (value.type === "text-delta") textChars += value.delta.length;
  if (value.type === "reasoning-delta") reasoningChars += value.delta.length;
  if (value.type === "finish") finishEvent = value;
  if (value.type === "response-metadata") responseMetadata = value;
}

const elapsed = Date.now() - start;
console.log(`elapsed: ${elapsed}ms`);
console.log(`event counts: ${JSON.stringify(Object.fromEntries(counts))}`);
console.log(`reasoning chars streamed: ${reasoningChars}`);
console.log(`text chars streamed: ${textChars}`);
console.log(`response metadata: ${JSON.stringify(responseMetadata)}`);
console.log(`finish: ${JSON.stringify(finishEvent)}`);
