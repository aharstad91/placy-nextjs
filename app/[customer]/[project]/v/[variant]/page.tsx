import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{
    customer: string;
    project: string;
    variant: string;
  }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function LegacyVariantPage({ params, searchParams }: PageProps) {
  const { customer, project } = await params;
  const resolvedSearch = await searchParams;
  const queryString = typeof resolvedSearch.c === "string" ? `?c=${resolvedSearch.c}` : "";
  redirect(`/${customer}/${project}${queryString}`);
}
