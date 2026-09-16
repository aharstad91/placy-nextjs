import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { DEMO_ACCESS_COOKIE, hostedVoiceEnabled, verifyDemoAccess } from "@/lib/live/hosted-access";
import { loadDataset } from "@/lib/demo/nyhavna-lokal/dataset";
import { buildLocalBoard, buildLocalProject } from "@/lib/demo/nyhavna-lokal/board";
import LokalBoardGate from "@/app/demo/nyhavna-lokal/lokal-board-gate";

/** Curated Nyhavna content, available locally and through explicit hosted demo access. */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Nyhavna — demo",
  description: "Utforsk Nyhavna med kart og samtaleguiden Anja.",
  robots: { index: false, follow: false },
};

export default async function NyhavnaLokalPage({ searchParams }: { searchParams: Promise<{ access?: string }> }) {
  if (process.env.NODE_ENV === "production" || hostedVoiceEnabled()) {
    if (!hostedVoiceEnabled()) notFound();
    const access = verifyDemoAccess((await cookies()).get(DEMO_ACCESS_COOKIE)?.value);
    if (!access) {
      const failed = (await searchParams).access === "failed";
      return (
        <main className="min-h-dvh bg-[#f5f2eb] px-6 py-24 text-[#153b57]">
          <div className="mx-auto max-w-sm">
            <p className="mb-3 text-sm uppercase tracking-widest">Nyhavna · Placy</p>
            <h1 className="mb-4 text-3xl font-semibold">Velkommen til demoen</h1>
            <p className="mb-8">Utforsk nabolaget sammen med Anja. Skriv inn tilgangskoden du har fått.</p>
            <form action="/api/demo/access" method="post" className="space-y-4">
              <label htmlFor="demo-code" className="block text-sm font-medium">Tilgangskode</label>
              <input id="demo-code" name="code" type="password" autoComplete="current-password" required maxLength={256} className="w-full rounded-xl border border-[#153b57]/30 bg-white p-3 text-base" />
              {failed && <p role="alert" className="text-sm text-red-800">Koden stemmer ikke. Prøv igjen.</p>}
              <button type="submit" className="w-full rounded-xl bg-[#153b57] p-3 font-medium text-white">Åpne demoen</button>
            </form>
          </div>
        </main>
      );
    }
  }

  // Feilen fra lasteren peker på fil, felt og hva som manglet, og får boble opp
  // som den er. En demo som stille faller tilbake til noe annet er verdiløs.
  const dataset = await loadDataset();
  const project = buildLocalProject(dataset);
  const board = buildLocalBoard(dataset);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <LokalBoardGate project={project} boardData={board} />
    </div>
  );
}
