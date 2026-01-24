"use client";

import type { ReactNode } from "react";

interface MainContentProps {
  children: ReactNode;
}

// Wrapper for scrollbart hovedinnhold
export function MainContent({ children }: MainContentProps) {
  return (
    <main className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {children}
      </div>
    </main>
  );
}
