import { redirect } from "next/navigation";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

// Redirect til demo-prosjektet, bevar ?c= for collection-lenker
export default async function Home({ searchParams }: PageProps) {
  const params = await searchParams;
  const collectionSlug = params.c;

  if (typeof collectionSlug === "string") {
    redirect(`/klp-eiendom/ferjemannsveien-10/v/explorer?c=${collectionSlug}`);
  }

  redirect("/klp-eiendom/ferjemannsveien-10");
}
