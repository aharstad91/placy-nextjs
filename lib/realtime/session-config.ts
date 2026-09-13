/**
 * Modellvalget for den gjenværende Realtime-banen (bolig-prototypen).
 *
 * Nyhavna-demoen bruker GPT-Live-1 og `lib/live/session-config.ts`; instruksene
 * og sesjonsoppsettet som hørte til Nyhavnas Realtime-sesjon er slettet.
 */
export const realtimeModel = () => process.env.OPENAI_BOARD_REALTIME_MODEL || "gpt-realtime-2.1-mini";
