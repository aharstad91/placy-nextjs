import { PageTransition } from "@/components/transitions";

interface LayoutProps {
  children: React.ReactNode;
}

export default function EventProjectLayout({ children }: LayoutProps) {
  return (
    <PageTransition>
      {children}
    </PageTransition>
  );
}
