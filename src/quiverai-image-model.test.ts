import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QuiverAIImageModel } from './quiverai-image-model';

const mockPostJsonToApi = vi.fn();

vi.mock('@ai-sdk/provider-utils', async importOriginal => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    postJsonToApi: (...args: any[]) => mockPostJsonToApi(...args),
  };
});

function mockApiResponse(value: unknown) {
  mockPostJsonToApi.mockResolvedValue({
    value,
    responseHeaders: {},
  });
}

describe('QuiverAIImageModel', () => {
  let model: QuiverAIImageModel;

  beforeEach(() => {
    vi.clearAllMocks();
    model = new QuiverAIImageModel('arrow-preview', {
      provider: 'quiverai.image',
      headers: { Authorization: 'Bearer test-key' },
      baseURL: 'https://api.quiver.ai/v1',
    });
  });

  describe('doGenerate - generateSVG path', () => {
    it('should generate SVG from text prompt', async () => {
      mockApiResponse({
        id: 'svg-123',
        created: 1700000000,
        data: [{ mimeType: 'image/svg+xml', svg: '<svg>circle</svg>' }],
        usage: { inputTokens: 10, outputTokens: 50, totalTokens: 60 },
      });

      const result = await model.doGenerate({
        prompt: 'a red circle',
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        files: undefined,
        mask: undefined,
        providerOptions: {},
      });

      expect(mockPostJsonToApi).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://api.quiver.ai/v1/svgs/generations',
          body: expect.objectContaining({
            model: 'arrow-preview',
            prompt: 'a red circle',
            stream: false,
            n: 1,
          }),
        }),
      );

      expect(result.images).toHaveLength(1);
      const decoder = new TextDecoder();
      expect(decoder.decode(result.images[0] as Uint8Array)).toBe(
        '<svg>circle</svg>',
      );
      expect(result.warnings).toEqual([]);
      expect(result.usage).toEqual({
        inputTokens: 10,
        outputTokens: 50,
        totalTokens: 60,
      });
    });

    it('should warn on unsupported options', async () => {
      mockApiResponse({
        id: 'svg-123',
        created: 1700000000,
        data: [{ mimeType: 'image/svg+xml', svg: '<svg/>' }],
      });

      const result = await model.doGenerate({
        prompt: 'test',
        n: 1,
        size: '1024x1024',
        aspectRatio: '16:9',
        seed: 42,
        files: undefined,
        mask: undefined,
        providerOptions: {},
      });

      expect(result.warnings).toEqual([
        { type: 'unsupported', feature: 'size' },
        { type: 'unsupported', feature: 'aspectRatio' },
        { type: 'unsupported', feature: 'seed' },
      ]);
    });

    it('should warn on mask option', async () => {
      mockApiResponse({
        id: 'svg-123',
        created: 1700000000,
        data: [{ mimeType: 'image/svg+xml', svg: '<svg/>' }],
      });

      const result = await model.doGenerate({
        prompt: 'test',
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        files: undefined,
        mask: { type: 'url', url: 'https://example.com/mask.png' },
        providerOptions: {},
      });

      expect(result.warnings).toEqual([
        { type: 'unsupported', feature: 'mask' },
      ]);
    });

    it('should pass provider options', async () => {
      mockApiResponse({
        id: 'svg-123',
        created: 1700000000,
        data: [{ mimeType: 'image/svg+xml', svg: '<svg/>' }],
      });

      await model.doGenerate({
        prompt: 'test',
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        files: undefined,
        mask: undefined,
        providerOptions: {
          quiverai: {
            instructions: 'flat style',
            temperature: 0.5,
          },
        },
      });

      expect(mockPostJsonToApi).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            instructions: 'flat style',
            temperature: 0.5,
          }),
        }),
      );
    });
  });

  describe('doGenerate - vectorizeSVG path', () => {
    it('should vectorize when files are provided', async () => {
      mockApiResponse({
        id: 'vec-123',
        created: 1700000000,
        data: [{ mimeType: 'image/svg+xml', svg: '<svg>vectorized</svg>' }],
        usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
      });

      const result = await model.doGenerate({
        prompt: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        files: [
          {
            type: 'url',
            url: 'https://example.com/image.png',
          },
        ],
        mask: undefined,
        providerOptions: {},
      });

      expect(mockPostJsonToApi).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://api.quiver.ai/v1/svgs/vectorizations',
          body: expect.objectContaining({
            model: 'arrow-preview',
            image: { url: 'https://example.com/image.png' },
            stream: false,
          }),
        }),
      );

      const decoder = new TextDecoder();
      expect(decoder.decode(result.images[0] as Uint8Array)).toBe(
        '<svg>vectorized</svg>',
      );
    });

    it('should handle base64 file input', async () => {
      mockApiResponse({
        id: 'vec-123',
        created: 1700000000,
        data: [{ mimeType: 'image/svg+xml', svg: '<svg/>' }],
      });

      await model.doGenerate({
        prompt: undefined,
        n: 1,
        size: undefined,
        aspectRatio: undefined,
        seed: undefined,
        files: [
          {
            type: 'file',
            mediaType: 'image/png',
            data: 'base64data',
          },
        ],
        mask: undefined,
        providerOptions: {},
      });

      expect(mockPostJsonToApi).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            image: { base64: 'base64data' },
          }),
        }),
      );
    });
  });

  describe('error handling', () => {
    it('should propagate API errors', async () => {
      mockPostJsonToApi.mockRejectedValue(
        new Error('QuiverAI API error: invalid_request - Bad prompt'),
      );

      await expect(
        model.doGenerate({
          prompt: 'test',
          n: 1,
          size: undefined,
          aspectRatio: undefined,
          seed: undefined,
          files: undefined,
          mask: undefined,
          providerOptions: {},
        }),
      ).rejects.toThrow('QuiverAI API error');
    });
  });
});
