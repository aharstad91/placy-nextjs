import { redirect } from "next/navigation";
import { GenerateClient } from "./generate-client";

export const metadata = {
  title: "Story Generator | Placy Admin",
  description: "Generer nye stories for Placy-prosjekter",
};

export default async function GeneratePage() {
  // Simple admin check
  if (process.env.ADMIN_ENABLED !== "true") {
    redirect("/");
  }

  return <GenerateClient />;
}
