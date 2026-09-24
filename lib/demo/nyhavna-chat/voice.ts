/**
 * Stemmen i Nyhavna-kopiens chatboks (2026-09-24). Klient-trygt: brukes av
 * talebroen i `app/demo/nyhavna-nettside/layout.tsx`. Datasettet er det samme
 * som tekstchattens profil og `NH_VOICE_DATASET` på serveren.
 */
export { CHAT_VOICE_CONTINUED_GREETING as NH_CHAT_VOICE_CONTINUED_GREETING } from "@/lib/demo/leangenbukta-chat/voice-channel";

export const NH_CHAT_VOICE_DATASET = "nyhavna-lokal";

/** Hilsenen er en instruksjon til stemmen, ikke en ferdig replikk (se `useLive`). */
export const NH_CHAT_VOICE_GREETING =
  "Si en kort hilsen på norsk: at du er Anja fra Placy, og spør om de vil høre om bydelen som planlegges på Nyhavna eller om nærområdet slik det er i dag. Høyst to setninger.";
