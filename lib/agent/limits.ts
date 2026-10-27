// Hard limits for every live run. The Worker enforces these; the site only displays them.

export const LIMITS = {
  maxSteps: 6,
  maxToolCalls: 8,
  maxTokensPerCall: 1200,
  tokenBudgetPerRun: 25_000,
  timeoutMs: 45_000,
  maxQuestionChars: 300,
  maxOrganizationsChars: 200,
  dailyPerVisitor: 3,
  dailyGlobal: 50,
} as const;

export type Limits = { [K in keyof typeof LIMITS]: number };

export const DEFAULT_MODEL = "claude-haiku-5-5";

/** USD per million tokens for the default model. Check https://www.anthropic.com/pricing before relying on it. */
export const PRICE_PER_MTOK = { input: 0.1, output: 0.5 };

export function estimateCostUsd(inputTokens: number, outputTokens: number): number {
  const cost = (inputTokens * PRICE_PER_MTOK.input + outputTokens * PRICE_PER_MTOK.output) / 1_000_000;
  return Math.round(cost * 1_000_000) / 1_000_000;
}
