import PlacyHeader from "@/components/public/PlacyHeader";
import PlacyFooter from "@/components/public/PlacyFooter";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <PlacyHeader locale="no" />
      <main className="min-h-screen bg-[#faf9f7]">{children}</main>
      <PlacyFooter locale="no" />
    </>
  );
}
