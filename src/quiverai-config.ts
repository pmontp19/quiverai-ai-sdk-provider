import type { FetchFunction, Resolvable } from "@ai-sdk/provider-utils";

export interface QuiverAIConfig {
  provider: string;
  baseURL: string;
  headers: Resolvable<Record<string, string | undefined>>;
  fetch?: FetchFunction;
  _internal?: {
    currentDate?: () => Date;
  };
}
