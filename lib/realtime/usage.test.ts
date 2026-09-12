import { describe, expect, it } from "vitest";
import { realtimeCost } from "@/lib/realtime/usage";

describe("Realtime cost estimate", () => {
  it("subtracts cached audio/text and includes reasoning output without double counting", () => {
    const cost = realtimeCost("gpt-realtime-2.1-mini", {
      input_tokens: 2000, output_tokens: 500,
      input_token_details: { text_tokens: 1000, audio_tokens: 1000, cached_tokens: 1000, cached_tokens_details: { text_tokens: 500, audio_tokens: 500 } },
      output_token_details: { text_tokens: 100, audio_tokens: 200 },
    });
    expect(cost).toBeCloseTo((500 * .6 + 500 * .06 + 500 * 10 + 500 * .3 + 300 * 2.4 + 200 * 20) / 1e6, 9);
  });
  it("does not invent prices or cache splits for incomplete usage", () => {
    expect(realtimeCost("unknown", { input_tokens: 100, output_tokens: 10 })).toBeNull();
    expect(realtimeCost("gpt-realtime-2.1-mini", { input_tokens: 100, output_tokens: 10, input_token_details: { cached_tokens: 80 }, output_token_details: {} })).toBeNull();
  });
});
