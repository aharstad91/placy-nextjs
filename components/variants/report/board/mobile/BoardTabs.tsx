"use client";

interface Tab {
  id: string;
  label: string;
}

interface Props {
  tabs: Tab[];
  value: string;
  onChange: (id: string) => void;
}

/** Mac-app-inspirert pill-tab. Egen komponent fordi shadcn Tabs arver theme-CSS-vars som gir ujevn farge. */
export function BoardTabs({ tabs, value, onChange }: Props) {
  return (
    <div
      role="tablist"
      className="inline-flex items-center gap-1 p-1 rounded-full bg-stone-200/80 mb-5 self-start"
    >
      {tabs.map((tab) => {
        const active = value === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
              active
                ? "bg-white text-stone-900 shadow-[0_1px_3px_rgba(15,29,68,0.12)]"
                : "text-stone-500 hover:text-stone-700"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
