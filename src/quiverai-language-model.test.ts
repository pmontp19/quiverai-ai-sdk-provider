import { beforeEach, describe, expect, it, vi } from "vitest";
import { QuiverAILanguageModel } from "./quiverai-language-model";

const mockPostJsonToApi = vi.fn();
const mockPostToApi = vi.fn();

vi.mock("@ai-sdk/provider-utils", async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    postJsonToApi: (...args: any[]) => mockPostJsonToApi(...args),
    postToApi: (...args: any[]) => mockPostToApi(...args),
  };
});

function mockJsonApiResponse(value: unknown) {
  mockPostJsonToApi.mockResolvedValue({
    value,
    responseHeaders: {},
  });
}

function createSseResponse(events: Array<{ event?: string; data: string }>) {
  const text = `${events
    .map((e) => {
      const lines: string[] = [];
      if (e.event) lines.push(`event: ${e.event}`);
      lines.push(`data: ${e.data}`);
      return lines.join("\n");
    })
    .join("\n\n")}\n\n`;

  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
}

function mockStreamApiResponse(
  events: Array<{ event?: string; data: string }>,
) {
  mockPostToApi.mockResolvedValue({
    value: createSseResponse(events),
    responseHeaders: {},
  });
}

describe("QuiverAILanguageModel", () => {
  let model: QuiverAILanguageModel;

  beforeEach(() => {
    vi.clearAllMocks();
    model = new QuiverAILanguageModel("arrow-1.1", {
      provider: "quiverai.languageModel",
      headers: { Authorization: "Bearer test-key" },
      baseURL: "https://api.quiver.ai/v1",
    });
  });

  describe("doGenerate", () => {
    it("should generate SVG as text from prompt", async () => {
      mockJsonApiResponse({
        id: "svg-123",
        created: 1700000000,
        data: [{ mime_type: "image/svg+xml", svg: "<svg>circle</svg>" }],
        credits: 20,
      });

      const result = await model.doGenerate({
        prompt: [
          { role: "user", content: [{ type: "text", text: "a red circle" }] },
        ],
        providerOptions: {},
      });

      expect(mockPostJsonToApi).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "https://api.quiver.ai/v1/svgs/generations",
          body: expect.objectContaining({
            model: "arrow-1.1",
            prompt: "a red circle",
            stream: false,
            n: 1,
          }),
        }),
      );

      expect(result.content).toEqual([
        { type: "text", text: "<svg>circle</svg>" },
      ]);
      expect(result.finishReason).toEqual({ unified: "stop", raw: "stop" });
      expect(result.usage.inputTokens.total).toBeUndefined();
      expect(result.usage.outputTokens.total).toBeUndefined();
      expect(result.providerMetadata?.quiverai).toEqual({ credits: 20 });
    });

    it("should combine system and user messages into prompt", async () => {
      mockJsonApiResponse({
        id: "svg-123",
        created: 1700000000,
        data: [{ mime_type: "image/svg+xml", svg: "<svg/>" }],
      });

      await model.doGenerate({
        prompt: [
          { role: "system", content: "You create SVGs" },
          {
            role: "user",
            content: [{ type: "text", text: "a blue square" }],
          },
        ],
        providerOptions: {},
      });

      expect(mockPostJsonToApi).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            prompt: "You create SVGs\na blue square",
          }),
        }),
      );
    });

    it("should use vectorizeSVG when only image is in prompt", async () => {
      mockJsonApiResponse({
        id: "vec-123",
        created: 1700000000,
        data: [{ mime_type: "image/svg+xml", svg: "<svg>vectorized</svg>" }],
        credits: 15,
      });

      const result = await model.doGenerate({
        prompt: [
          {
            role: "user",
            content: [
              {
                type: "file",
                data: "https://example.com/image.png",
                mediaType: "image/png",
              },
            ],
          },
        ],
        providerOptions: {},
      });

      expect(mockPostJsonToApi).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "https://api.quiver.ai/v1/svgs/vectorizations",
          body: expect.objectContaining({
            image: { url: "https://example.com/image.png" },
            stream: false,
          }),
        }),
      );

      // vectorize must not send `n`
      const body = mockPostJsonToApi.mock.calls[0][0].body;
      expect(body).not.toHaveProperty("n");

      expect(result.content).toEqual([
        { type: "text", text: "<svg>vectorized</svg>" },
      ]);
      expect(result.providerMetadata?.quiverai).toEqual({ credits: 15 });
    });

    it("should send references when prompt has text + image", async () => {
      mockJsonApiResponse({
        id: "svg-123",
        created: 1700000000,
        data: [{ mime_type: "image/svg+xml", svg: "<svg/>" }],
      });

      await model.doGenerate({
        prompt: [
          {
            role: "user",
            content: [
              { type: "text", text: "a stylized version of this" },
              {
                type: "file",
                data: "https://example.com/ref.png",
                mediaType: "image/png",
              },
            ],
          },
        ],
        providerOptions: {},
      });

      expect(mockPostJsonToApi).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "https://api.quiver.ai/v1/svgs/generations",
          body: expect.objectContaining({
            prompt: "a stylized version of this",
            references: [{ url: "https://example.com/ref.png" }],
          }),
        }),
      );
    });

    it("should merge providerOptions.references with prompt references", async () => {
      mockJsonApiResponse({
        id: "svg-123",
        created: 1700000000,
        data: [{ mime_type: "image/svg+xml", svg: "<svg/>" }],
      });

      await model.doGenerate({
        prompt: [
          { role: "user", content: [{ type: "text", text: "an icon" }] },
        ],
        providerOptions: {
          quiverai: {
            references: [
              "https://example.com/a.png",
              { url: "https://example.com/b.png" },
            ],
          },
        },
      });

      const body = mockPostJsonToApi.mock.calls[0][0].body;
      expect(body.references).toEqual([
        { url: "https://example.com/a.png" },
        { url: "https://example.com/b.png" },
      ]);
    });

    it("should warn on unsupported options", async () => {
      mockJsonApiResponse({
        id: "svg-123",
        created: 1700000000,
        data: [{ mime_type: "image/svg+xml", svg: "<svg/>" }],
      });

      const result = await model.doGenerate({
        prompt: [{ role: "user", content: [{ type: "text", text: "test" }] }],
        responseFormat: { type: "json" },
        tools: [
          { type: "function", name: "test", inputSchema: { type: "object" } },
        ],
        frequencyPenalty: 0.5,
        stopSequences: ["stop"],
        topK: 5,
        seed: 42,
        providerOptions: {},
      });

      expect(result.warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ feature: "responseFormat" }),
          expect.objectContaining({ feature: "tools" }),
          expect.objectContaining({ feature: "frequencyPenalty" }),
          expect.objectContaining({ feature: "stopSequences" }),
          expect.objectContaining({ feature: "topK" }),
          expect.objectContaining({ feature: "seed" }),
        ]),
      );
    });

    it("should throw on API error", async () => {
      mockPostJsonToApi.mockRejectedValue(
        new Error(
          "QuiverAI API error: rate_limit_exceeded - Too many requests",
        ),
      );

      await expect(
        model.doGenerate({
          prompt: [{ role: "user", content: [{ type: "text", text: "test" }] }],
          providerOptions: {},
        }),
      ).rejects.toThrow("QuiverAI API error");
    });
  });

  describe("doStream", () => {
    it("should stream SVG events with generating and content events", async () => {
      mockStreamApiResponse([
        {
          event: "generating",
          data: JSON.stringify({
            type: "generating",
            text: "Thinking about the shape...",
          }),
        },
        {
          event: "draft",
          data: JSON.stringify({
            type: "draft",
            id: "op-1",
            svg: "<svg><circle",
          }),
        },
        {
          event: "draft",
          data: JSON.stringify({
            type: "draft",
            id: "op-1",
            svg: ' r="50"/>',
          }),
        },
        {
          event: "content",
          data: JSON.stringify({
            type: "content",
            id: "op-1",
            svg: '<svg><circle r="50" fill="red"/></svg>',
            credits: 20,
          }),
        },
      ]);

      const result = await model.doStream({
        prompt: [
          { role: "user", content: [{ type: "text", text: "a red circle" }] },
        ],
        providerOptions: {},
      });

      const parts: Array<{ type: string } & Record<string, unknown>> = [];
      const reader = result.stream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(value as never);
      }

      const types = parts.map((p) => p.type);
      expect(types).toContain("stream-start");
      expect(types).toContain("reasoning-start");
      expect(types).toContain("reasoning-delta");
      expect(types).toContain("reasoning-end");
      expect(types).toContain("text-start");
      expect(types).toContain("text-delta");
      expect(types).toContain("text-end");
      expect(types).toContain("finish");

      const reasoningDelta = parts.find((p) => p.type === "reasoning-delta");
      expect(reasoningDelta).toMatchObject({
        delta: "Thinking about the shape...",
      });

      const textDeltas = parts.filter((p) => p.type === "text-delta");
      expect(textDeltas).toHaveLength(2);

      const finish = parts.find((p) => p.type === "finish");
      expect(finish).toMatchObject({
        type: "finish",
        providerMetadata: { quiverai: { credits: 20 } },
      });
    });

    it("should stream without reasoning events", async () => {
      mockStreamApiResponse([
        {
          event: "draft",
          data: JSON.stringify({ type: "draft", id: "op-1", svg: "<svg>" }),
        },
        {
          event: "content",
          data: JSON.stringify({
            type: "content",
            id: "op-1",
            svg: "<svg><rect/></svg>",
            credits: 20,
          }),
        },
      ]);

      const result = await model.doStream({
        prompt: [
          { role: "user", content: [{ type: "text", text: "a square" }] },
        ],
        providerOptions: {},
      });

      const parts: Array<{ type: string }> = [];
      const reader = result.stream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(value);
      }

      const types = parts.map((p) => p.type);
      expect(types).not.toContain("reasoning-start");
      expect(types).toContain("text-start");
      expect(types).toContain("text-delta");
      expect(types).toContain("text-end");
      expect(types).toContain("finish");
    });

    it("should not emit finish after error", async () => {
      const encoder = new TextEncoder();
      const errorStream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              'event: draft\ndata: {"type":"draft","svg":"<svg>"}\n\n',
            ),
          );
          controller.error(new Error("network failure"));
        },
      });
      mockPostToApi.mockResolvedValue({
        value: errorStream,
        responseHeaders: {},
      });

      const result = await model.doStream({
        prompt: [{ role: "user", content: [{ type: "text", text: "test" }] }],
        providerOptions: {},
      });

      const parts: Array<{ type: string }> = [];
      const reader = result.stream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(value);
      }

      const types = parts.map((p) => p.type);
      expect(types).toContain("error");
      expect(types).not.toContain("finish");
      expect(types).not.toContain("response-metadata");
    });

    it("should yield final SSE event when stream closes without trailing \\n\\n", async () => {
      const encoder = new TextEncoder();
      const noTrailingNewlineStream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              "event: content\ndata: " +
                JSON.stringify({
                  type: "content",
                  id: "op-1",
                  svg: "<svg>final</svg>",
                  credits: 20,
                }),
            ),
          );
          controller.close();
        },
      });
      mockPostToApi.mockResolvedValue({
        value: noTrailingNewlineStream,
        responseHeaders: {},
      });

      const result = await model.doStream({
        prompt: [{ role: "user", content: [{ type: "text", text: "test" }] }],
        providerOptions: {},
      });

      const parts: Array<{ type: string }> = [];
      const reader = result.stream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(value);
      }

      const types = parts.map((p) => p.type);
      expect(types).toContain("text-start");
      expect(types).toContain("text-delta");
      expect(types).toContain("text-end");
      expect(types).toContain("finish");
    });

    it("should call vectorize endpoint when only image is in prompt", async () => {
      mockStreamApiResponse([
        {
          event: "content",
          data: JSON.stringify({
            type: "content",
            id: "op-1",
            svg: "<svg>vec</svg>",
            credits: 15,
          }),
        },
      ]);

      await model.doStream({
        prompt: [
          {
            role: "user",
            content: [
              {
                type: "file",
                data: "https://example.com/img.png",
                mediaType: "image/png",
              },
            ],
          },
        ],
        providerOptions: {},
      });

      expect(mockPostToApi).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "https://api.quiver.ai/v1/svgs/vectorizations",
        }),
      );
    });
  });
});
