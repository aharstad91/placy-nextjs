import { redirect } from "next/navigation";
import { getAllKnowledgeAdmin } from "@/lib/supabase/queries";
import { KnowledgeAdminClient } from "./knowledge-admin-client";

export const dynamic = "force-dynamic";

const adminEnabled = process.env.ADMIN_ENABLED === "true";

export default async function KnowledgeAdminPage() {
  if (!adminEnabled) {
    redirect("/");
  }

  const knowledge = await getAllKnowledgeAdmin();

  return <KnowledgeAdminClient knowledge={knowledge} />;
}
