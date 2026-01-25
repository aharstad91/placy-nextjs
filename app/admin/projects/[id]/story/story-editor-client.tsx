"use client";

import { useState, useCallback } from "react";
import {
  Save,
  Loader2,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Check,
  X,
  ArrowUp,
  ArrowDown,
  Star,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type {
  ThemeStoryWithSections,
  SectionWithPois,
  PoiBasic,
  StoryEditorPayload,
} from "./page";

interface StoryEditorClientProps {
  project: { id: string; name: string; customer_id: string | null };
  themeStories: ThemeStoryWithSections[];
  allProjectPois: PoiBasic[];
  saveChanges: (payload: StoryEditorPayload) => Promise<void>;
}

// Local state types
interface LocalThemeStory {
  id: string;
  title: string;
  bridgeText: string;
  sections: LocalSection[];
}

interface LocalSection {
  id: string;
  title: string;
  description: string;
  poiIds: string[];
}

// Transform server data to local state
function toLocalState(themeStories: ThemeStoryWithSections[]): LocalThemeStory[] {
  return themeStories.map((ts) => ({
    id: ts.id,
    title: ts.title,
    bridgeText: ts.bridge_text || "",
    sections: ts.sections.map((section) => ({
      id: section.id,
      title: section.title,
      description: section.description || "",
      poiIds: section.pois.map((p) => p.id),
    })),
  }));
}

// Sortable POI Item component
function SortablePoiItem({
  poi,
  isSelected,
  onToggle,
}: {
  poi: PoiBasic;
  isSelected: boolean;
  onToggle: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: poi.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 p-2 rounded-lg border ${
        isSelected
          ? "bg-white border-gray-200"
          : "bg-gray-50 border-gray-100 opacity-60"
      }`}
    >
      <button
        className="cursor-grab text-gray-400 hover:text-gray-600 touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-4 h-4" />
      </button>

      <button
        onClick={onToggle}
        className={`w-5 h-5 rounded flex items-center justify-center border ${
          isSelected
            ? "bg-emerald-500 border-emerald-500 text-white"
            : "bg-white border-gray-300"
        }`}
      >
        {isSelected && <Check className="w-3 h-3" />}
      </button>

      <span className={`flex-1 text-sm ${!isSelected && "line-through text-gray-400"}`}>
        {poi.name}
      </span>

      {poi.google_rating && (
        <span className="flex items-center gap-0.5 text-xs text-gray-500">
          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
          {poi.google_rating.toFixed(1)}
        </span>
      )}
    </div>
  );
}

export function StoryEditorClient({
  project,
  themeStories: initialThemeStories,
  allProjectPois,
  saveChanges,
}: StoryEditorClientProps) {
  // Local state for editing
  const [stories, setStories] = useState<LocalThemeStory[]>(() =>
    toLocalState(initialThemeStories)
  );
  const [originalStories] = useState<LocalThemeStory[]>(() =>
    toLocalState(initialThemeStories)
  );

  // UI state
  const [expandedThemes, setExpandedThemes] = useState<Set<string>>(
    () => new Set(initialThemeStories.map((ts) => ts.id))
  );
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    () =>
      new Set(
        initialThemeStories.flatMap((ts) =>
          ts.sections.map((s) => s.id)
        )
      )
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Create POI lookup map
  const poisMap: Record<string, PoiBasic> = {};
  for (const poi of allProjectPois) {
    poisMap[poi.id] = poi;
  }

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Check if there are changes
  const hasChanges = JSON.stringify(stories) !== JSON.stringify(originalStories);

  // Toggle theme expansion
  const toggleTheme = (themeId: string) => {
    setExpandedThemes((prev) => {
      const next = new Set(prev);
      if (next.has(themeId)) {
        next.delete(themeId);
      } else {
        next.add(themeId);
      }
      return next;
    });
  };

  // Toggle section expansion
  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  // Update bridge text
  const updateBridgeText = (themeId: string, value: string) => {
    setStories((prev) =>
      prev.map((ts) =>
        ts.id === themeId ? { ...ts, bridgeText: value } : ts
      )
    );
  };

  // Update section description
  const updateSectionDescription = (
    themeId: string,
    sectionId: string,
    value: string
  ) => {
    setStories((prev) =>
      prev.map((ts) =>
        ts.id === themeId
          ? {
              ...ts,
              sections: ts.sections.map((s) =>
                s.id === sectionId ? { ...s, description: value } : s
              ),
            }
          : ts
      )
    );
  };

  // Toggle POI selection
  const togglePoi = (themeId: string, sectionId: string, poiId: string) => {
    setStories((prev) =>
      prev.map((ts) =>
        ts.id === themeId
          ? {
              ...ts,
              sections: ts.sections.map((s) =>
                s.id === sectionId
                  ? {
                      ...s,
                      poiIds: s.poiIds.includes(poiId)
                        ? s.poiIds.filter((id) => id !== poiId)
                        : [...s.poiIds, poiId],
                    }
                  : s
              ),
            }
          : ts
      )
    );
  };

  // Handle drag end for POI reordering
  const handleDragEnd = useCallback(
    (themeId: string, sectionId: string) => (event: DragEndEvent) => {
      const { active, over } = event;

      if (over && active.id !== over.id) {
        setStories((prev) =>
          prev.map((ts) =>
            ts.id === themeId
              ? {
                  ...ts,
                  sections: ts.sections.map((s) => {
                    if (s.id !== sectionId) return s;

                    const oldIndex = s.poiIds.indexOf(active.id as string);
                    const newIndex = s.poiIds.indexOf(over.id as string);

                    return {
                      ...s,
                      poiIds: arrayMove(s.poiIds, oldIndex, newIndex),
                    };
                  }),
                }
              : ts
          )
        );
      }
    },
    []
  );

  // Save changes
  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const payload: StoryEditorPayload = {
        themeStories: stories.map((ts) => ({
          id: ts.id,
          bridgeText: ts.bridgeText || null,
        })),
        sections: stories.flatMap((ts) =>
          ts.sections.map((s) => ({
            id: s.id,
            description: s.description || null,
          }))
        ),
        sectionPois: stories.flatMap((ts) =>
          ts.sections.map((s) => ({
            sectionId: s.id,
            poiIds: s.poiIds,
          }))
        ),
      };

      await saveChanges(payload);
      setSuccessMessage("Endringer lagret!");

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke lagre endringer");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Story Editor
            </h1>
            <p className="text-sm text-gray-500">{project.name}</p>
          </div>

          <button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all ${
              hasChanges && !isSaving
                ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            }`}
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Lagre endringer
          </button>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-2">
            <X className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 flex items-center gap-2">
            <Check className="w-5 h-5 flex-shrink-0" />
            {successMessage}
          </div>
        )}

        {/* Theme Stories */}
        <div className="space-y-4">
          {stories.map((theme) => (
            <div
              key={theme.id}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden"
            >
              {/* Theme Header */}
              <button
                onClick={() => toggleTheme(theme.id)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                {expandedThemes.has(theme.id) ? (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                )}
                <span className="font-semibold text-gray-900">
                  {theme.title}
                </span>
                <span className="text-sm text-gray-400">
                  {theme.sections.reduce((acc, s) => acc + s.poiIds.length, 0)} POI-er
                </span>
              </button>

              {/* Theme Content */}
              {expandedThemes.has(theme.id) && (
                <div className="px-4 pb-4 space-y-4">
                  {/* Bridge Text */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Bridge text
                    </label>
                    <textarea
                      value={theme.bridgeText}
                      onChange={(e) =>
                        updateBridgeText(theme.id, e.target.value)
                      }
                      placeholder="Intro-tekst for dette temaet..."
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      rows={2}
                    />
                  </div>

                  {/* Sections */}
                  <div className="space-y-3">
                    {theme.sections.map((section) => (
                      <div
                        key={section.id}
                        className="border border-gray-100 rounded-lg overflow-hidden"
                      >
                        {/* Section Header */}
                        <button
                          onClick={() => toggleSection(section.id)}
                          className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
                        >
                          {expandedSections.has(section.id) ? (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                          )}
                          <span className="font-medium text-sm text-gray-700">
                            {section.title}
                          </span>
                          <span className="text-xs text-gray-400">
                            {section.poiIds.length} POI-er
                          </span>
                        </button>

                        {/* Section Content */}
                        {expandedSections.has(section.id) && (
                          <div className="p-3 space-y-3">
                            {/* Section Description */}
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">
                                Beskrivelse
                              </label>
                              <textarea
                                value={section.description}
                                onChange={(e) =>
                                  updateSectionDescription(
                                    theme.id,
                                    section.id,
                                    e.target.value
                                  )
                                }
                                placeholder="Beskrivelse av denne seksjonen..."
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                                rows={2}
                              />
                            </div>

                            {/* POI List */}
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-2">
                                POI-er (dra for å sortere)
                              </label>
                              <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={handleDragEnd(theme.id, section.id)}
                              >
                                <SortableContext
                                  items={section.poiIds}
                                  strategy={verticalListSortingStrategy}
                                >
                                  <div className="space-y-1">
                                    {section.poiIds.map((poiId) => {
                                      const poi = poisMap[poiId];
                                      if (!poi) return null;

                                      return (
                                        <SortablePoiItem
                                          key={poiId}
                                          poi={poi}
                                          isSelected={true}
                                          onToggle={() =>
                                            togglePoi(theme.id, section.id, poiId)
                                          }
                                        />
                                      );
                                    })}
                                  </div>
                                </SortableContext>
                              </DndContext>

                              {section.poiIds.length === 0 && (
                                <p className="text-sm text-gray-400 italic py-2">
                                  Ingen POI-er i denne seksjonen
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {stories.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">
              Ingen tema-stories funnet for dette prosjektet.
            </p>
            <p className="text-sm text-gray-400 mt-1">
              Kjør story generator først for å opprette innhold.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
