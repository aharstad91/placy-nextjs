"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import MapGL, { Marker, NavigationControl, type MapRef } from "react-map-gl/mapbox";
import {
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  X,
  Loader2,
  Tag,
  MapPin,
  Star,
  ChevronDown,
  ChevronRight,
  Compass,
  FileText,
  Map,
  AlertCircle,
  Check,
  Minus,
  ExternalLink,
} from "lucide-react";
import {
  IconPicker,
  ColorPicker,
  ConfirmDialog,
  ICON_MAP,
} from "@/components/admin";
import type {
  DbCategory,
  DbProjectCategory,
  DbCustomer,
} from "@/lib/supabase/types";
import type { ProjectWithRelations, ProductWithPois } from "./page";
import { DiscoveryCirclesEditor } from "./discovery-circles-editor";
import { ImportTab } from "./import-tab";

// NOTE: "Kategorier"-fanen er skjult — prosjekt-kategorier brukes ikke i praksis.
// Vurder å fjerne CategoriesTab og relatert kode helt hvis det forblir ubrukt.
const TABS = [
  { id: "details", label: "Detaljer" },
  // { id: "categories", label: "Kategorier" },
  { id: "products", label: "Produkter" },
  { id: "pois", label: "POI-er" },
  { id: "import", label: "Import" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const PRODUCT_TYPE_CONFIG = {
  explorer: { label: "Explorer", icon: Compass, color: "emerald", route: "explore" },
  report: { label: "Report", icon: FileText, color: "rose", route: "report" },
  guide: { label: "Guide", icon: Map, color: "amber", route: "guide" },
} as const;

interface ProjectDetailClientProps {
  project: ProjectWithRelations;
  customers: Pick<DbCustomer, "id" | "name">[];
  globalCategories: DbCategory[];
  allPois: Array<{
    id: string;
    name: string;
    category_id: string | null;
    categories: { id: string; name: string; color: string } | null;
  }>;
  updateProject: (formData: FormData) => Promise<void>;
  createProjectCategory: (formData: FormData) => Promise<void>;
  updateProjectCategory: (formData: FormData) => Promise<void>;
  deleteProjectCategory: (formData: FormData) => Promise<void>;
  addPoiToProject: (formData: FormData) => Promise<void>;
  batchAddPoisToProject: (formData: FormData) => Promise<void>;
  removePoiFromProject: (formData: FormData) => Promise<void>;
  addPoiToProduct: (formData: FormData) => Promise<void>;
  removePoiFromProduct: (formData: FormData) => Promise<void>;
  batchAddPoisToProduct: (formData: FormData) => Promise<void>;
  batchRemovePoisFromProduct: (formData: FormData) => Promise<void>;
  createProduct: (formData: FormData) => Promise<void>;
}

export function ProjectDetailClient({
  project,
  customers,
  globalCategories,
  allPois,
  updateProject,
  createProjectCategory,
  updateProjectCategory,
  deleteProjectCategory,
  addPoiToProject,
  batchAddPoisToProject,
  removePoiFromProject,
  addPoiToProduct,
  removePoiFromProduct,
  batchAddPoisToProduct,
  batchRemovePoisFromProduct,
  createProduct,
}: ProjectDetailClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("details");

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-8 py-8">
        {/* Header */}
        <Link
          href="/admin/projects"
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Tilbake til prosjekter
        </Link>

        <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
        <p className="text-gray-500">
          Kunde: {project.customers?.name || "Ingen"}
        </p>

        {/* Tabs */}
        <div className="mt-6 border-b border-gray-200">
          <nav className="flex gap-6">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="mt-6">
          {activeTab === "details" && (
            <div className="space-y-6">
              <DetailsTab
                project={project}
                customers={customers}
                updateProject={updateProject}
              />
              <DiscoveryCirclesEditor
                projectId={project.id}
                centerLat={project.center_lat}
                centerLng={project.center_lng}
                initialCircles={project.discovery_circles ?? null}
                onSaved={() => router.refresh()}
              />
            </div>
          )}
          {/* NOTE: CategoriesTab skjult — prosjekt-kategorier brukes ikke. Fjern helt hvis det forblir ubrukt. */}
          {activeTab === "pois" && (
            <PoisTab
              project={project}
              globalCategories={globalCategories}
              allPois={allPois}
              addPoiToProject={addPoiToProject}
              batchAddPoisToProject={batchAddPoisToProject}
              removePoiFromProject={removePoiFromProject}
            />
          )}
          {activeTab === "products" && (
            <ProductsTab
              project={project}
              addPoiToProduct={addPoiToProduct}
              removePoiFromProduct={removePoiFromProduct}
              batchAddPoisToProduct={batchAddPoisToProduct}
              batchRemovePoisFromProduct={batchRemovePoisFromProduct}
              createProduct={createProduct}
            />
          )}
          {activeTab === "import" && (
            <ImportTab project={project} onSwitchTab={(tab) => setActiveTab(tab as TabId)} />
          )}
        </div>
      </div>
    </div>
  );
}

// ============ DETAILS TAB ============

interface DetailsTabProps {
  project: ProjectWithRelations;
  customers: Pick<DbCustomer, "id" | "name">[];
  updateProject: (formData: FormData) => Promise<void>;
}

function DetailsTab({ project, customers, updateProject }: DetailsTabProps) {
  const [customerId, setCustomerId] = useState(project.customer_id || "");
  const [name, setName] = useState(project.name);
  const [urlSlug, setUrlSlug] = useState(project.url_slug);
  const [centerLat, setCenterLat] = useState(project.center_lat.toString());
  const [centerLng, setCenterLng] = useState(project.center_lng.toString());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const formData = new FormData();
      formData.set("id", project.id);
      formData.set("shortId", project.short_id);
      formData.set("customerId", customerId);
      formData.set("name", name);
      formData.set("urlSlug", urlSlug);
      formData.set("centerLat", centerLat);
      formData.set("centerLng", centerLng);

      await updateProject(formData);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Noe gikk galt");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-6">
        Prosjektdetaljer
      </h2>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-100 text-green-600 rounded-xl text-sm">
          Endringer lagret!
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-gray-600">
            Kunde
          </label>
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="w-full px-3 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-300 transition-all"
          >
            <option value="">Ingen kunde</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-gray-600">
            Navn *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-300 transition-all"
            required
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-gray-600">
            URL Slug *
          </label>
          <input
            type="text"
            value={urlSlug}
            onChange={(e) => setUrlSlug(e.target.value)}
            className="w-full px-3 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-300 transition-all font-mono"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-gray-600">
              Senter Lat *
            </label>
            <input
              type="text"
              value={centerLat}
              onChange={(e) => setCenterLat(e.target.value)}
              className="w-full px-3 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-300 transition-all font-mono"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-gray-600">
              Senter Lng *
            </label>
            <input
              type="text"
              value={centerLng}
              onChange={(e) => setCenterLng(e.target.value)}
              className="w-full px-3 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-300 transition-all font-mono"
              required
            />
          </div>
        </div>

        <div className="pt-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-xl transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Lagrer...
              </>
            ) : (
              "Lagre endringer"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

// ============ CATEGORIES TAB ============

interface CategoriesTabProps {
  project: ProjectWithRelations;
  createProjectCategory: (formData: FormData) => Promise<void>;
  updateProjectCategory: (formData: FormData) => Promise<void>;
  deleteProjectCategory: (formData: FormData) => Promise<void>;
}

function CategoriesTab({
  project,
  createProjectCategory,
  updateProjectCategory,
  deleteProjectCategory,
}: CategoriesTabProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] =
    useState<DbProjectCategory | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DbProjectCategory | null>(
    null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [categoryName, setCategoryName] = useState("");
  const [categoryIcon, setCategoryIcon] = useState("MapPin");
  const [categoryColor, setCategoryColor] = useState("#3b82f6");

  // Count POIs per category
  const poiCountByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const pp of project.project_pois) {
      if (pp.project_category_id) {
        counts[pp.project_category_id] =
          (counts[pp.project_category_id] || 0) + 1;
      }
    }
    return counts;
  }, [project.project_pois]);

  const openCreateModal = () => {
    setEditingCategory(null);
    setCategoryName("");
    setCategoryIcon("MapPin");
    setCategoryColor("#3b82f6");
    setError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (category: DbProjectCategory) => {
    setEditingCategory(category);
    setCategoryName(category.name);
    setCategoryIcon(category.icon);
    setCategoryColor(category.color);
    setError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCategory(null);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("projectId", project.id);
      formData.set("shortId", project.short_id);
      formData.set("name", categoryName);
      formData.set("icon", categoryIcon);
      formData.set("color", categoryColor);

      if (editingCategory) {
        formData.set("id", editingCategory.id);
        await updateProjectCategory(formData);
      } else {
        await createProjectCategory(formData);
      }

      closeModal();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Noe gikk galt");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.set("id", deleteTarget.id);
      formData.set("shortId", project.short_id);
      await deleteProjectCategory(formData);
      setDeleteTarget(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke slette");
      setDeleteTarget(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const projectCategories = project.project_categories || [];

  if (projectCategories.length === 0 && !isModalOpen) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
        <Tag className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Ingen prosjekt-kategorier
        </h3>
        <p className="text-gray-500 mb-6 max-w-sm mx-auto">
          Opprett en kategori for å tilpasse kategoriseringen av POI-er i dette
          prosjektet.
        </p>
        <button
          onClick={openCreateModal}
          className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-600 hover:to-emerald-700 flex items-center gap-2 text-sm font-semibold shadow-lg shadow-emerald-500/25 transition-all mx-auto"
        >
          <Plus className="w-4 h-4" /> Ny kategori
        </button>
      </div>
    );
  }

  return (
    <div>
      {error && !isModalOpen && (
        <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">
          {projectCategories.length} kategori
          {projectCategories.length !== 1 && "er"}
        </p>
        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-600 hover:to-emerald-700 flex items-center gap-2 text-sm font-semibold shadow-lg shadow-emerald-500/25 transition-all"
        >
          <Plus className="w-4 h-4" /> Ny kategori
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {projectCategories.map((cat) => {
          const IconComponent = ICON_MAP[cat.icon] || MapPin;
          const poiCount = poiCountByCategory[cat.id] || 0;

          return (
            <div
              key={cat.id}
              className="flex items-center gap-4 p-4 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors"
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: cat.color }}
              >
                <IconComponent className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <div className="font-medium text-gray-900">{cat.name}</div>
                <div className="text-sm text-gray-500">
                  {poiCount} POI-er bruker denne kategorien
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => openEditModal(cat)}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Rediger"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setDeleteTarget(cat)}
                  disabled={poiCount > 0}
                  className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title={
                    poiCount > 0
                      ? "Kan ikke slette - kategorien er i bruk"
                      : "Slett"
                  }
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingCategory ? "Rediger kategori" : "Ny kategori"}
              </h2>
              <button
                onClick={closeModal}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-gray-600">
                  Navn *
                </label>
                <input
                  type="text"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-300 transition-all"
                  placeholder="F.eks. Sentrum Øst"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-gray-600">
                  Ikon
                </label>
                <IconPicker value={categoryIcon} onChange={setCategoryIcon} />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-gray-600">
                  Farge
                </label>
                <ColorPicker value={categoryColor} onChange={setCategoryColor} />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                >
                  Avbryt
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Lagrer...
                    </>
                  ) : editingCategory ? (
                    "Oppdater"
                  ) : (
                    "Opprett"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Slett kategori"
        message={`Er du sikker på at du vil slette kategorien "${deleteTarget?.name}"?`}
        confirmLabel="Slett"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

// ============ POIs TAB ============

const MAP_STYLE = "mapbox://styles/mapbox/streets-v12";

interface PoisTabProps {
  project: ProjectWithRelations;
  globalCategories: DbCategory[];
  allPois: Array<{
    id: string;
    name: string;
    category_id: string | null;
    categories: { id: string; name: string; color: string } | null;
  }>;
  addPoiToProject: (formData: FormData) => Promise<void>;
  batchAddPoisToProject: (formData: FormData) => Promise<void>;
  removePoiFromProject: (formData: FormData) => Promise<void>;
}

function PoisTab({
  project,
  globalCategories,
  allPois,
  addPoiToProject,
  batchAddPoisToProject,
  removePoiFromProject,
}: PoisTabProps) {
  const mapRef = useRef<MapRef>(null);

  // State
  // Include "" for uncategorized POIs so they are not silently filtered out
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
    () => new Set([...globalCategories.map((c) => c.id), ""])
  );
  const [hoveredPoiId, setHoveredPoiId] = useState<string | null>(null);
  const [activePoiId, setActivePoiId] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addSearchQuery, setAddSearchQuery] = useState("");
  const [selectedAddPois, setSelectedAddPois] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const projectPois = project.project_pois || [];
  const projectPoiIds = useMemo(
    () => new Set(projectPois.map((pp) => pp.poi_id)),
    [projectPois]
  );

  // Categories that exist in this project's POIs
  const projectCategoryStats = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const pp of projectPois) {
      const catId = pp.pois.category_id || "";
      counts[catId] = (counts[catId] || 0) + 1;
    }
    return counts;
  }, [projectPois]);

  // Only show categories that have POIs in this project
  const activeProjectCategories = useMemo(
    () => globalCategories.filter((c) => (projectCategoryStats[c.id] || 0) > 0),
    [globalCategories, projectCategoryStats]
  );

  // Filter POIs by selected categories
  const filteredPois = useMemo(
    () => projectPois.filter((pp) => selectedCategories.has(pp.pois.category_id || "")),
    [projectPois, selectedCategories]
  );

  // POIs available to add (not in project), filtered by search
  const availablePois = useMemo(() => {
    const available = allPois.filter((poi) => !projectPoiIds.has(poi.id));
    if (!addSearchQuery.trim()) return available;
    const q = addSearchQuery.toLowerCase();
    return available.filter((poi) => poi.name.toLowerCase().includes(q));
  }, [allPois, projectPoiIds, addSearchQuery]);

  // Group available POIs by category for the modal
  const availableByCategory = useMemo(() => {
    const groups: Record<string, typeof availablePois> = {};
    for (const poi of availablePois) {
      const catName = poi.categories?.name || "Ukategorisert";
      if (!groups[catName]) groups[catName] = [];
      groups[catName].push(poi);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [availablePois]);

  // Hide Mapbox default labels on load
  const handleMapLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (map) {
      for (const layer of ["poi-label", "transit-label"]) {
        if (map.getLayer(layer)) {
          map.setLayoutProperty(layer, "visibility", "none");
        }
      }
    }
  }, []);

  const handleRemovePoi = async () => {
    if (!removeTarget) return;
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.set("projectId", project.id);
      formData.set("shortId", project.short_id);
      formData.set("poiId", removeTarget);
      formData.set("customerSlug", project.customer_id || "");
      formData.set("projectSlug", project.url_slug);
      await removePoiFromProject(formData);
      setRemoveTarget(null);
      setActivePoiId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke fjerne POI");
      setRemoveTarget(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBatchAdd = async () => {
    if (selectedAddPois.size === 0) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("projectId", project.id);
      formData.set("shortId", project.short_id);
      formData.set("poiIds", JSON.stringify(Array.from(selectedAddPois)));
      await batchAddPoisToProject(formData);
      setIsAddModalOpen(false);
      setSelectedAddPois(new Set());
      setAddSearchQuery("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke legge til POI-er");
    } finally {
      setIsSubmitting(false);
    }
  };

  const activePoi = activePoiId
    ? projectPois.find((pp) => pp.poi_id === activePoiId)
    : null;

  if (projectPois.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
        <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Ingen POI-er</h3>
        <p className="text-gray-500 mb-6">
          Dette prosjektet har ingen POI-er ennå.
        </p>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-600 hover:to-emerald-700 flex items-center gap-2 text-sm font-semibold shadow-lg shadow-emerald-500/25 transition-all mx-auto"
        >
          <Plus className="w-4 h-4" /> Legg til POI-er
        </button>
        {/* Add Modal rendered at bottom */}
        {isAddModalOpen && renderAddModal()}
      </div>
    );
  }

  function renderAddModal() {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 pb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Legg til POI-er
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {selectedAddPois.size > 0
                  ? `${selectedAddPois.size} valgt`
                  : `${availablePois.length} tilgjengelige`}
              </p>
            </div>
            <button
              onClick={() => {
                setIsAddModalOpen(false);
                setSelectedAddPois(new Set());
                setAddSearchQuery("");
              }}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search */}
          <div className="px-6 pb-3">
            <input
              type="text"
              value={addSearchQuery}
              onChange={(e) => setAddSearchQuery(e.target.value)}
              placeholder="Søk etter POI..."
              className="w-full px-3 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-300 transition-all placeholder:text-gray-400"
            />
          </div>

          {/* POI list grouped by category */}
          <div className="flex-1 overflow-y-auto px-6">
            {availableByCategory.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">
                {addSearchQuery ? "Ingen POI-er matcher søket" : "Alle POI-er er allerede i prosjektet"}
              </p>
            ) : (
              availableByCategory.map(([categoryName, pois]) => (
                <div key={categoryName} className="mb-4">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    {categoryName}
                    <span className="ml-1 text-gray-400 font-normal">({pois.length})</span>
                  </h3>
                  <div className="space-y-1">
                    {pois.map((poi) => {
                      const isSelected = selectedAddPois.has(poi.id);
                      return (
                        <button
                          key={poi.id}
                          onClick={() => {
                            const newSet = new Set(selectedAddPois);
                            if (isSelected) {
                              newSet.delete(poi.id);
                            } else {
                              newSet.add(poi.id);
                            }
                            setSelectedAddPois(newSet);
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                            isSelected
                              ? "bg-emerald-50 text-emerald-800"
                              : "hover:bg-gray-50 text-gray-700"
                          }`}
                        >
                          <div
                            className={`w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border-2 transition-colors ${
                              isSelected
                                ? "bg-emerald-500 border-emerald-500"
                                : "border-gray-300"
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <span className="truncate">{poi.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-3 p-6 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={() => {
                setIsAddModalOpen(false);
                setSelectedAddPois(new Set());
                setAddSearchQuery("");
              }}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
            >
              Avbryt
            </button>
            <button
              type="button"
              onClick={handleBatchAdd}
              disabled={selectedAddPois.size === 0 || isSubmitting}
              className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Legger til...
                </>
              ) : (
                `Legg til ${selectedAddPois.size || ""} POI-er`
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Map + Sidebar container */}
      <div className="h-[calc(100vh-220px)] min-h-[500px] flex rounded-xl overflow-hidden border border-gray-200 bg-white shadow-sm">
        {/* Sidebar */}
        <div className="w-72 flex-shrink-0 flex flex-col border-r border-gray-200 bg-white">
          {/* Stats header */}
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-semibold text-gray-900">
                  {projectPois.length}
                </span>
                <span className="text-sm text-gray-500 ml-1">POI-er</span>
                <span className="text-xs text-gray-400 ml-2">
                  {activeProjectCategories.length} kategorier
                </span>
              </div>
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="p-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-sm"
                title="Legg til POI-er"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Category filters */}
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Filter
                <span className="ml-2 text-gray-400 font-normal normal-case">
                  {filteredPois.length}/{projectPois.length}
                </span>
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() =>
                    setSelectedCategories(new Set([...globalCategories.map((c) => c.id), ""]))
                  }
                  className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Alle
                </button>
                <button
                  onClick={() => setSelectedCategories(new Set())}
                  className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Ingen
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {activeProjectCategories.map((category) => {
                const isSelected = selectedCategories.has(category.id);
                const count = projectCategoryStats[category.id] || 0;
                return (
                  <button
                    key={category.id}
                    onClick={() => {
                      const newSet = new Set(selectedCategories);
                      if (isSelected) {
                        newSet.delete(category.id);
                      } else {
                        newSet.add(category.id);
                      }
                      setSelectedCategories(newSet);
                    }}
                    className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all ${
                      isSelected
                        ? "text-white shadow-sm"
                        : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                    }`}
                    style={{
                      backgroundColor: isSelected ? category.color : undefined,
                    }}
                  >
                    <span className="truncate max-w-[120px]">{category.name}</span>
                    <span
                      className={`px-1 py-0.5 rounded text-[10px] font-semibold ${
                        isSelected ? "bg-white/25" : "bg-gray-200/80 text-gray-500"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
              {/* Show "Ukategorisert" chip if there are POIs without a category */}
              {(projectCategoryStats[""] || 0) > 0 && (
                <button
                  onClick={() => {
                    const newSet = new Set(selectedCategories);
                    if (newSet.has("")) {
                      newSet.delete("");
                    } else {
                      newSet.add("");
                    }
                    setSelectedCategories(newSet);
                  }}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all ${
                    selectedCategories.has("")
                      ? "text-white shadow-sm bg-gray-500"
                      : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <span className="truncate max-w-[120px]">Ukategorisert</span>
                  <span
                    className={`px-1 py-0.5 rounded text-[10px] font-semibold ${
                      selectedCategories.has("") ? "bg-white/25" : "bg-gray-200/80 text-gray-500"
                    }`}
                  >
                    {projectCategoryStats[""]}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* POI list in sidebar */}
          <div className="flex-1 overflow-y-auto">
            {filteredPois.map((pp) => {
              const poi = pp.pois;
              const category = poi.categories;
              const isActive = activePoiId === pp.poi_id;
              return (
                <button
                  key={pp.poi_id}
                  onClick={() => {
                    setActivePoiId(isActive ? null : pp.poi_id);
                    if (!isActive) {
                      mapRef.current?.flyTo({
                        center: [poi.lng, poi.lat],
                        zoom: 15,
                        duration: 800,
                      });
                    }
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors border-b border-gray-50 ${
                    isActive
                      ? "bg-blue-50 border-l-2 border-l-blue-500"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: category?.color || "#6b7280" }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-gray-900 truncate text-xs">
                      {poi.name}
                    </div>
                    <div className="text-[10px] text-gray-400 truncate">
                      {category?.name || "Ukategorisert"}
                      {poi.google_rating && ` · ${poi.google_rating.toFixed(1)}`}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-gray-100 bg-gray-50">
            <span className="text-xs text-gray-500">
              Viser <span className="font-semibold text-gray-700">{filteredPois.length}</span> av{" "}
              <span className="font-semibold text-gray-700">{projectPois.length}</span> POI-er
            </span>
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 relative">
          <MapGL
            ref={mapRef}
            mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
            initialViewState={{
              longitude: project.center_lng,
              latitude: project.center_lat,
              zoom: 13,
            }}
            style={{ width: "100%", height: "100%" }}
            mapStyle={MAP_STYLE}
            onLoad={handleMapLoad}
            onClick={() => setActivePoiId(null)}
          >
            <NavigationControl position="top-right" />

            {/* POI Markers */}
            {filteredPois.map((pp) => {
              const poi = pp.pois;
              const category = poi.categories;
              const isActive = activePoiId === pp.poi_id;
              const isHovered = hoveredPoiId === pp.poi_id;

              return (
                <Marker
                  key={pp.poi_id}
                  longitude={poi.lng}
                  latitude={poi.lat}
                  anchor="center"
                  onClick={(e) => {
                    e.originalEvent.stopPropagation();
                    setActivePoiId(isActive ? null : pp.poi_id);
                  }}
                >
                  <div
                    className="relative flex flex-col items-center"
                    onMouseEnter={() => setHoveredPoiId(pp.poi_id)}
                    onMouseLeave={() => setHoveredPoiId(null)}
                  >
                    {/* Hover/active label */}
                    {(isHovered || isActive) && (
                      <div className="absolute bottom-full mb-2 whitespace-nowrap pointer-events-none z-10">
                        <div className="px-2.5 py-1.5 bg-gray-900/95 text-white text-xs rounded-lg shadow-xl">
                          <span className="font-medium">{poi.name}</span>
                        </div>
                        <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2 h-2 bg-gray-900/95 rotate-45" />
                      </div>
                    )}
                    {/* Marker dot */}
                    <div className="w-6 h-6 flex items-center justify-center cursor-pointer">
                      {isActive && (
                        <div className="absolute w-9 h-9 rounded-full bg-blue-400/20 animate-pulse" />
                      )}
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                          isActive ? "scale-125" : "hover:scale-110"
                        }`}
                        style={{
                          background: `linear-gradient(135deg, ${category?.color || "#6b7280"} 0%, ${category?.color || "#6b7280"}dd 100%)`,
                          boxShadow: `0 2px 8px ${category?.color || "#6b7280"}40`,
                        }}
                      >
                        <MapPin className="w-3 h-3 text-white drop-shadow-sm" />
                      </div>
                    </div>
                  </div>
                </Marker>
              );
            })}
          </MapGL>

          {/* Active POI popup overlay */}
          {activePoi && (
            <div className="absolute bottom-4 left-4 right-4 max-w-sm bg-white rounded-xl shadow-xl border border-gray-200 p-4 z-10">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                      backgroundColor: `${activePoi.pois.categories?.color || "#6b7280"}20`,
                    }}
                  >
                    <MapPin
                      className="w-4 h-4"
                      style={{ color: activePoi.pois.categories?.color || "#6b7280" }}
                    />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900 text-sm truncate">
                      {activePoi.pois.name}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {activePoi.pois.categories?.name || "Ukategorisert"}
                      {activePoi.pois.google_rating && (
                        <span className="ml-2">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400 inline" />{" "}
                          {activePoi.pois.google_rating.toFixed(1)}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActivePoiId(null)}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded-lg transition-colors flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => setRemoveTarget(activePoi.poi_id)}
                  className="flex-1 px-3 py-2 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Fjern fra prosjekt
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add POI Modal */}
      {isAddModalOpen && renderAddModal()}

      {/* Remove Confirmation */}
      <ConfirmDialog
        isOpen={!!removeTarget}
        title="Fjern POI fra prosjekt"
        message="Er du sikker på at du vil fjerne denne POI-en fra prosjektet? POI-en slettes ikke, den fjernes bare fra dette prosjektet."
        confirmLabel="Fjern"
        variant="danger"
        onConfirm={handleRemovePoi}
        onCancel={() => setRemoveTarget(null)}
      />
    </div>
  );
}

// ============ PRODUCTS TAB ============

interface ProductsTabProps {
  project: ProjectWithRelations;
  addPoiToProduct: (formData: FormData) => Promise<void>;
  removePoiFromProduct: (formData: FormData) => Promise<void>;
  batchAddPoisToProduct: (formData: FormData) => Promise<void>;
  batchRemovePoisFromProduct: (formData: FormData) => Promise<void>;
  createProduct: (formData: FormData) => Promise<void>;
}

function ProductsTab({
  project,
  addPoiToProduct,
  removePoiFromProduct,
  batchAddPoisToProduct,
  batchRemovePoisFromProduct,
  createProduct,
}: ProductsTabProps) {
  const [expandedProductId, setExpandedProductId] = useState<string | null>(
    null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newProductType, setNewProductType] = useState<"explorer" | "report" | "guide">("explorer");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const toggleCategory = (productId: string, categoryName: string) => {
    const key = `${productId}::${categoryName}`;
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Track optimistic updates for checkboxes
  const [optimisticUpdates, setOptimisticUpdates] = useState<
    Record<string, boolean>
  >({});

  const products = project.products || [];
  const projectPois = project.project_pois || [];

  const toggleProduct = (productId: string) => {
    setExpandedProductId((prev) => (prev === productId ? null : productId));
  };

  const handleTogglePoi = async (
    product: ProductWithPois,
    poiId: string,
    isCurrentlySelected: boolean
  ) => {
    const key = `${product.id}-${poiId}`;

    // Optimistic update
    setOptimisticUpdates((prev) => ({
      ...prev,
      [key]: !isCurrentlySelected,
    }));

    setIsSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("productId", product.id);
      formData.set("poiId", poiId);
      formData.set("shortId", project.short_id);
      formData.set("customerSlug", project.customer_id || "");
      formData.set("projectSlug", project.url_slug);

      if (isCurrentlySelected) {
        await removePoiFromProduct(formData);
      } else {
        await addPoiToProduct(formData);
      }

      // Clear optimistic update after successful save (server data will take over)
      setOptimisticUpdates((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } catch (e) {
      // Revert optimistic update on error
      setOptimisticUpdates((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setError(e instanceof Error ? e.message : "Kunne ikke oppdatere");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Shared batch toggle for both "select all" and per-category toggles
  const handleBatchToggle = async (
    product: ProductWithPois,
    poisSubset: typeof projectPois,
    selectAll: boolean
  ) => {
    const poisToToggle = selectAll
      ? poisSubset.filter((pp) => !isPoiSelected(product, pp.pois.id))
      : poisSubset.filter((pp) => isPoiSelected(product, pp.pois.id));

    if (poisToToggle.length === 0) return;

    setIsSubmitting(true);
    setError(null);

    const newOptimistic: Record<string, boolean> = {};
    for (const pp of poisToToggle) {
      newOptimistic[`${product.id}-${pp.pois.id}`] = selectAll;
    }
    setOptimisticUpdates((prev) => ({ ...prev, ...newOptimistic }));

    const clearOptimistic = () => {
      setOptimisticUpdates((prev) => {
        const next = { ...prev };
        for (const pp of poisToToggle) {
          delete next[`${product.id}-${pp.pois.id}`];
        }
        return next;
      });
    };

    try {
      const formData = new FormData();
      formData.set("productId", product.id);
      formData.set("poiIds", JSON.stringify(poisToToggle.map((pp) => pp.pois.id)));
      formData.set("shortId", project.short_id);
      formData.set("customerSlug", project.customer_id || "");
      formData.set("projectSlug", project.url_slug);

      if (selectAll) {
        await batchAddPoisToProduct(formData);
      } else {
        await batchRemovePoisFromProduct(formData);
      }
      clearOptimistic();
    } catch (e) {
      clearOptimistic();
      setError(e instanceof Error ? e.message : "Kunne ikke oppdatere POI-er");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isPoiSelected = (product: ProductWithPois, poiId: string): boolean => {
    const key = `${product.id}-${poiId}`;
    // Check optimistic update first
    if (key in optimisticUpdates) {
      return optimisticUpdates[key];
    }
    // Otherwise use server data
    return product.product_pois.some((pp) => pp.poi_id === poiId);
  };

  // Only count product_pois that are still in the project pool
  const projectPoiIds = useMemo(
    () => new Set(projectPois.map((pp) => pp.poi_id)),
    [projectPois]
  );

  const getSelectedCount = (product: ProductWithPois): number => {
    let count = product.product_pois.filter((pp) => projectPoiIds.has(pp.poi_id)).length;
    // Adjust for optimistic updates
    for (const [key, isSelected] of Object.entries(optimisticUpdates)) {
      if (key.startsWith(`${product.id}-`)) {
        const poiId = key.slice(`${product.id}-`.length);
        if (!projectPoiIds.has(poiId)) continue; // skip orphaned entries
        const wasSelected = product.product_pois.some(
          (pp) => key === `${product.id}-${pp.poi_id}`
        );
        if (isSelected && !wasSelected) count++;
        if (!isSelected && wasSelected) count--;
      }
    }
    return count;
  };

  // Group POIs by category for display
  const poisByCategory = useMemo(() => {
    const groups: Record<string, typeof projectPois> = {};
    for (const pp of projectPois) {
      const catName = pp.pois.categories?.name || "Ukategorisert";
      if (!groups[catName]) groups[catName] = [];
      groups[catName].push(pp);
    }
    return Object.entries(groups)
      .sort(([a], [b]) => {
        if (a === "Ukategorisert") return 1;
        if (b === "Ukategorisert") return -1;
        return a.localeCompare(b);
      })
      .map(([name, pois]) => ({
        name,
        pois: pois.sort((a, b) => a.pois.name.localeCompare(b.pois.name)),
      }));
  }, [projectPois]);

  const getSelectedCountForCategory = (
    product: ProductWithPois,
    categoryPois: typeof projectPois
  ): number => {
    return categoryPois.filter((pp) => isPoiSelected(product, pp.pois.id)).length;
  };

  // Get existing product types to show which are available
  const existingProductTypes = new Set(products.map((p) => p.product_type));
  const availableProductTypes = (["explorer", "report", "guide"] as const).filter(
    (type) => !existingProductTypes.has(type)
  );

  const handleCreateProduct = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("projectId", project.id);
      formData.set("shortId", project.short_id);
      formData.set("productType", newProductType);

      await createProduct(formData);
      setIsCreateModalOpen(false);
      setNewProductType("explorer");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke opprette produkt");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Create product modal component (defined early for use in empty states)
  const CreateProductModal = () => {
    if (!isCreateModalOpen) return null;

    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">
              Nytt produkt
            </h2>
            <button
              onClick={() => {
                setIsCreateModalOpen(false);
                setError(null);
              }}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm">
              {error}
            </div>
          )}

          {availableProductTypes.length === 0 ? (
            <div className="text-center py-6">
              <Check className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <p className="text-gray-600">
                Alle produkttyper er allerede opprettet for dette prosjektet.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-gray-600">
                  Produkttype
                </label>
                <div className="space-y-2">
                  {availableProductTypes.map((type) => {
                    const config = PRODUCT_TYPE_CONFIG[type];
                    const IconComponent = config.icon;
                    const isSelected = newProductType === type;

                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setNewProductType(type)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                          isSelected
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            config.color === "emerald"
                              ? "bg-emerald-100"
                              : config.color === "rose"
                                ? "bg-rose-100"
                                : "bg-amber-100"
                          }`}
                        >
                          <IconComponent
                            className={`w-5 h-5 ${
                              config.color === "emerald"
                                ? "text-emerald-600"
                                : config.color === "rose"
                                  ? "text-rose-600"
                                  : "text-amber-600"
                            }`}
                          />
                        </div>
                        <div className="text-left">
                          <div className="font-medium text-gray-900">
                            {config.label}
                          </div>
                          <div className="text-xs text-gray-500">
                            {type === "explorer" && "Utforsk steder fritt på kartet"}
                            {type === "report" && "Redaksjonell artikkel med kart"}
                            {type === "guide" && "Kuratert tur med rekkefølge"}
                          </div>
                        </div>
                        {isSelected && (
                          <Check className="w-5 h-5 text-blue-500 ml-auto" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setError(null);
                  }}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                >
                  Avbryt
                </button>
                <button
                  type="button"
                  onClick={handleCreateProduct}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Oppretter...
                    </>
                  ) : (
                    "Opprett"
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Empty state: no products
  if (products.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
        <Compass className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Ingen produkter
        </h3>
        <p className="text-gray-500 mb-6 max-w-sm mx-auto">
          Dette prosjektet har ingen produkter ennå.
        </p>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-600 hover:to-emerald-700 text-sm font-semibold shadow-lg shadow-emerald-500/25 transition-all"
        >
          <Plus className="w-4 h-4" />
          Nytt produkt
        </button>
        <CreateProductModal />
      </div>
    );
  }

  // Empty state: no POIs in project pool
  if (projectPois.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
        <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Ingen POI-er i prosjektet
        </h3>
        <p className="text-gray-500 mb-6 max-w-sm mx-auto">
          Legg til POI-er i prosjektet først for å kunne velge hvilke som skal
          vises i hvert produkt.
        </p>
        <p className="text-sm text-blue-600">
          Gå til &quot;POI-er&quot;-fanen for å legge til POI-er.
        </p>
      </div>
    );
  }

  return (
    <div>
      {error && !isCreateModalOpen && (
        <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">
          {products.length} produkt{products.length !== 1 && "er"} &middot;{" "}
          {projectPois.length} POI-er i prosjektbassenget
        </p>
        {availableProductTypes.length > 0 && (
          <button
            onClick={() => {
              setNewProductType(availableProductTypes[0]);
              setIsCreateModalOpen(true);
            }}
            className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-600 hover:to-emerald-700 flex items-center gap-2 text-sm font-semibold shadow-lg shadow-emerald-500/25 transition-all"
          >
            <Plus className="w-4 h-4" />
            Nytt produkt
          </button>
        )}
      </div>

      <div className="space-y-3">
        {products.map((product) => {
          const config =
            PRODUCT_TYPE_CONFIG[
              product.product_type as keyof typeof PRODUCT_TYPE_CONFIG
            ] || PRODUCT_TYPE_CONFIG.explorer;
          const IconComponent = config.icon;
          const isExpanded = expandedProductId === product.id;
          const selectedCount = getSelectedCount(product);
          const totalCount = projectPois.length;

          return (
            <div
              key={product.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
            >
              {/* Product Header */}
              <div className="flex items-center">
                <button
                  onClick={() => toggleProduct(product.id)}
                  className="flex-1 flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="text-gray-400">
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5" />
                    ) : (
                      <ChevronRight className="w-5 h-5" />
                    )}
                  </div>
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      config.color === "emerald"
                        ? "bg-emerald-100"
                        : config.color === "rose"
                          ? "bg-rose-100"
                          : "bg-amber-100"
                    }`}
                  >
                    <IconComponent
                      className={`w-5 h-5 ${
                        config.color === "emerald"
                          ? "text-emerald-600"
                          : config.color === "rose"
                            ? "text-rose-600"
                            : "text-amber-600"
                      }`}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{config.label}</div>
                    {product.story_title && (
                      <div className="text-sm text-gray-500 truncate">
                        {product.story_title}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedCount === 0 && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Ingen POI-er
                      </span>
                    )}
                    <span className="text-sm text-gray-500">
                      {selectedCount}/{totalCount} POI-er
                    </span>
                  </div>
                </button>
                {project.customer_id && (
                  <Link
                    href={`/${project.customer_id}/${project.url_slug}/${config.route}`}
                    target="_blank"
                    className="flex items-center gap-1.5 px-3 py-1.5 mr-3 text-sm text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title={`Åpne ${config.label}`}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Åpne
                  </Link>
                )}
              </div>

              {/* Expanded POI List */}
              {isExpanded && (
                <div className="border-t border-gray-100 p-4 bg-gray-50">
                  {/* Select All / Deselect All Header */}
                  <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-200">
                    <span className="text-sm text-gray-600">
                      {selectedCount} av {totalCount} valgt
                    </span>
                    <div className="flex items-center gap-2">
                      {selectedCount < totalCount && (
                        <button
                          onClick={() => handleBatchToggle(product, projectPois, true)}
                          disabled={isSubmitting}
                          className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50"
                        >
                          Velg alle
                        </button>
                      )}
                      {selectedCount > 0 && (
                        <button
                          onClick={() => handleBatchToggle(product, projectPois, false)}
                          disabled={isSubmitting}
                          className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
                        >
                          Fjern alle
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-4">
                    {poisByCategory.map((category) => {
                      const catSelectedCount = getSelectedCountForCategory(product, category.pois);
                      const catTotalCount = category.pois.length;
                      const allSelected = catSelectedCount === catTotalCount;
                      const someSelected = catSelectedCount > 0 && !allSelected;

                      const isCatExpanded = expandedCategories.has(`${product.id}::${category.name}`);

                      return (
                        <div key={category.name}>
                          {/* Category Header */}
                          <div className="flex items-center gap-3 p-2.5 bg-gray-100 rounded-lg mb-1">
                            {/* Checkbox area — toggles selection */}
                            <button
                              type="button"
                              onClick={() => handleBatchToggle(product, category.pois, !allSelected)}
                              disabled={isSubmitting}
                              className="flex-shrink-0 disabled:opacity-50"
                            >
                              <div
                                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                  allSelected
                                    ? "bg-blue-500 border-blue-500"
                                    : someSelected
                                      ? "bg-blue-500 border-blue-500"
                                      : "bg-white border-gray-300"
                                }`}
                              >
                                {allSelected && <Check className="w-3 h-3 text-white" />}
                                {someSelected && <Minus className="w-3 h-3 text-white" />}
                              </div>
                            </button>
                            {/* Accordion trigger — expands/collapses */}
                            <button
                              type="button"
                              onClick={() => toggleCategory(product.id, category.name)}
                              className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
                            >
                              <div className="text-gray-400">
                                {isCatExpanded ? (
                                  <ChevronDown className="w-4 h-4" />
                                ) : (
                                  <ChevronRight className="w-4 h-4" />
                                )}
                              </div>
                              <span className="text-sm font-semibold text-gray-700">
                                {category.name}
                              </span>
                              <span className="text-xs text-gray-500">
                                ({catTotalCount})
                              </span>
                              <span className="ml-auto text-xs text-gray-500">
                                {catSelectedCount}/{catTotalCount} valgt
                              </span>
                            </button>
                          </div>

                          {/* POIs in category (accordion) */}
                          {isCatExpanded && (
                          <div className="space-y-0.5 pl-2 mb-2">
                            {category.pois.map((pp) => {
                              const poi = pp.pois;
                              const selected = isPoiSelected(product, poi.id);
                              const key = `${product.id}-${poi.id}`;
                              const isPending = key in optimisticUpdates;

                              return (
                                <label
                                  key={poi.id}
                                  className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                                    selected
                                      ? "bg-blue-50 hover:bg-blue-100"
                                      : "hover:bg-gray-100"
                                  } ${isPending ? "opacity-70" : ""}`}
                                >
                                  <div className="relative">
                                    <input
                                      type="checkbox"
                                      checked={selected}
                                      onChange={() =>
                                        handleTogglePoi(product, poi.id, selected)
                                      }
                                      disabled={isSubmitting && isPending}
                                      className="sr-only"
                                    />
                                    <div
                                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                        selected
                                          ? "bg-blue-500 border-blue-500"
                                          : "bg-white border-gray-300"
                                      }`}
                                    >
                                      {selected && (
                                        <Check className="w-3 h-3 text-white" />
                                      )}
                                    </div>
                                    {isPending && (
                                      <Loader2 className="w-3 h-3 text-blue-500 animate-spin absolute -right-1 -top-1" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-gray-900 truncate">
                                      {poi.name}
                                    </div>
                                  </div>
                                  {poi.google_rating && (
                                    <div className="flex items-center gap-1 text-xs text-gray-500">
                                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                      {poi.google_rating.toFixed(1)}
                                    </div>
                                  )}
                                </label>
                              );
                            })}
                          </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <CreateProductModal />
    </div>
  );
}
