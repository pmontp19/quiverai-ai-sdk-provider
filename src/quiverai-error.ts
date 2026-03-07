import { AISDKError } from '@ai-sdk/provider';

const name = 'AI_QuiverAIError';
const marker = `vercel.ai.error.${name}`;
const symbol = Symbol.for(marker);

export class QuiverAIError extends AISDKError {
  private readonly [symbol] = true;

  constructor({ message, cause }: { message: string; cause?: unknown }) {
    super({ name, message, cause });
  }

  static isInstance(error: unknown): error is QuiverAIError {
    return AISDKError.hasMarker(error, marker);
  }
}
