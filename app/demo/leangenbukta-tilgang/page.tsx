import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { enterLeangenbuktaDemo } from "@/app/demo/leangenbukta-tilgang/actions";
import { lbDemoAccessConfigured, lbDemoFeedbackEmail, safeNextPath } from "@/lib/demo/leangenbukta-site/access";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Leangenbukta – demo fra Placy",
  description: "Tilgang til Placys konseptdemo for Leangenbukta.",
  robots: { index: false, follow: false },
};

/**
 * Innloggingen til Leangenbukta-kundedemoen.
 *
 * Siden sier tydelig at dette er en demo fra Placy og ikke kundens offisielle
 * nettsted, før noe av kopien vises. Uten konfigurert kode finnes siden bare i
 * utvikling, og da sender den rett videre — lokalt trengs ingen kode.
 */
export default async function LeangenbuktaTilgangPage({
  searchParams,
}: {
  searchParams: Promise<{ neste?: string; feil?: string }>;
}) {
  const { neste, feil } = await searchParams;
  const next = safeNextPath(neste);
  const feedbackEmail = lbDemoFeedbackEmail();
  if (!lbDemoAccessConfigured()) {
    if (process.env.NODE_ENV === "production") notFound();
    redirect(next);
  }

  return (
    <main className="min-h-screen bg-[#f4efe9] text-[#2a2c2e] flex items-center justify-center px-5 py-16">
      <div className="w-full max-w-md bg-white rounded-lg shadow-sm p-8">
        <p className="text-xs uppercase tracking-[0.12em] text-[#6b4f3a]">Konseptdemo fra Placy</p>
        <h1 className="mt-2 text-2xl font-semibold">Leangenbukta med Placy</h1>
        <p className="mt-3 text-sm leading-relaxed text-[#4a4c4e]">
          Dette er en lukket demo laget av Placy for Koteng Jenssen. Den viser en kopi av
          leangenbukta.no med Placys nabolagskart, Anja og tekstchat — ikke det offisielle
          nettstedet. Skjemaer sender ingenting.
        </p>
        <form action={enterLeangenbuktaDemo} className="mt-6 space-y-3">
          <input type="hidden" name="neste" value={next} />
          <label htmlFor="kode" className="block text-sm font-medium">
            Tilgangskode
          </label>
          <input
            id="kode"
            name="kode"
            type="password"
            autoComplete="current-password"
            required
            maxLength={256}
            aria-invalid={feil ? true : undefined}
            aria-describedby={feil ? "kode-feil" : undefined}
            className="w-full rounded border border-[#cbbfb3] px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-[#6b4f3a]"
          />
          {feil ? (
            <p id="kode-feil" role="alert" className="text-sm text-[#a33a2a]">
              Koden stemmer ikke. Prøv igjen, eller kontakt Placy.
            </p>
          ) : null}
          <button
            type="submit"
            className="w-full rounded bg-[#6b4f3a] px-4 py-2.5 text-white font-medium hover:bg-[#5a4231] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#6b4f3a]"
          >
            Åpne demoen
          </button>
        </form>
        <p className="mt-6 text-xs text-[#6d6f71]">
          Spørsmål eller tilbakemeldinger: <a className="underline" href={`mailto:${feedbackEmail}`}>{feedbackEmail}</a>
        </p>
      </div>
    </main>
  );
}
