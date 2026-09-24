import { describe, expect, it } from "vitest";
import { siteChatCustomer, siteChatCustomerForDataset, siteChatCustomers } from "@/lib/demo/site-chat/customers";
import { METER_NAME } from "@/lib/demo/site-chat/usage";
import { loadLiveDemo } from "@/lib/live/demos";

/**
 * Registerkontrakten for chatboks-kunder: det en ny kunde MÅ oppfylle før den
 * kan ligge i `customers.ts` (sjekklisten i docs/demos/site-chat.md).
 */
describe("chatboks-registeret", () => {
  it("har Leangenbukta og Nyhavna, og ingen andre", () => {
    expect(siteChatCustomers().map((customer) => [customer.id, customer.dataset])).toEqual([
      ["leangenbukta", "leangenbukta-lokal"],
      ["nyhavna", "nyhavna-lokal"],
    ]);
    expect(siteChatCustomer("ukjent")).toBeNull();
    expect(siteChatCustomerForDataset("nyhavna-leve")).toBeNull();
  });

  it.each(siteChatCustomers().map((customer) => [customer.id, customer] as const))("%s oppfyller kontrakten", async (_id, customer) => {
    // Datasettet finnes og stemmens stedsnavn er boardets eget.
    const demo = await loadLiveDemo(customer.dataset);
    expect(customer.voice.placeName).toBe(demo.board.home.name);
    // Målerne er gyldige og kundens egne.
    for (const meter of [customer.chatMeter, customer.voice.meter]) expect(meter.meter).toMatch(METER_NAME);
    // Hver kunde har egne miljøvariabler for nøkkel, kvote og innstillinger.
    const others = siteChatCustomers().filter((other) => other !== customer);
    for (const other of others) {
      expect(customer.transcriptSecretEnv).not.toBe(other.transcriptSecretEnv);
      expect(customer.chatMeter.envPrefix).not.toBe(other.chatMeter.envPrefix);
      expect(customer.env.model).not.toBe(other.env.model);
    }
    // Sidene har forslag, og hver kilde-ID er entydig i kundens register.
    expect(customer.getPage("forside")?.chatStarters.length).toBeGreaterThan(0);
    expect(customer.sourceRegistry().latestCheckedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Fallback-lenkene er interne stier.
    for (const link of customer.fallbackLinks()) expect(link.href).toMatch(/^\/[^/]/);
    expect(customer.voice.greeting).toContain(customer.voice.placeName);
  });
});
