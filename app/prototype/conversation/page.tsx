import type { Metadata } from "next";
import { getCachedReportProduct } from "@/lib/supabase/cached-board-reads";
import { buildLeveProject, LEVE_CUSTOMER, LEVE_PROJECT } from "@/lib/demo/nyhavna-leve/build";
import ConversationExperience from "@/components/prototype/ConversationExperience";

export const metadata: Metadata = { title: "Opplev Nyhavna — en samtale med Placy", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PrototypePage() {
  try {
    const project = await getCachedReportProduct(LEVE_CUSTOMER, LEVE_PROJECT);
    if (!project) throw new Error("Nyhavna-boardet ble ikke funnet");
    return <ConversationExperience project={buildLeveProject(project)} />;
  } catch (error) {
    console.error("Conversation prototype: Nyhavna data unavailable", error instanceof Error ? error.message : "Unknown error");
    return <main className="flex min-h-screen items-center justify-center bg-[#f7f5ef] p-8"><div className="max-w-md"><p className="mb-4 text-sm uppercase tracking-widest">Placy · Nyhavna</p><h1 className="mb-4 text-3xl">Nabolaget kunne ikke lastes akkurat nå.</h1><p>Last siden på nytt for å prøve igjen. Samtalen blir tilgjengelig når Nyhavna-boardet er lastet.</p><a href="/prototype/conversation" className="mt-6 inline-block rounded-full bg-[#203d35] px-6 py-3 text-white">Prøv igjen</a></div></main>;
  }
}
