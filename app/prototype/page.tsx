import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Placy prototype A — stemme i boardet", robots: { index: false, follow: false } };

export default function PrototypePage() {
  redirect("/eiendom/nyhavna-utvikling/nyhavna/leve");
}
