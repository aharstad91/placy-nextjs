"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
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
import type { ProjectWithRelations } from "./page";

const TABS = [
  { id: "details", label: "Detaljer" },
  { id: "categories", label: "Kategorier" },
  { id: "pois", label: "POI-er" },
] as const;

type TabId = (typeof TABS)[number]["id"];

interface ProjectDetailClientProps {
  project: ProjectWithRelations;
  customers: Pick<DbCustomer, "id" | "name">[];
  globalCategories: DbCategory[];
  allPois: Array<{ id: string; name: string; category_id: string | null }>;
  updateProject: (formData: FormData) => Promise<void>;
  createProjectCategory: (formData: FormData) => Promise<void>;
  updateProjectCategory: (formData: FormData) => Promise<void>;
  deleteProjectCategory: (formData: FormData) => Promise<void>;
  updateProjectPoiCategory: (formData: FormData) => Promise<void>;
  addPoiToProject: (formData: FormData) => Promise<void>;
  removePoiFromProject: (formData: FormData) => Promise<void>;
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
  updateProjectPoiCategory,
  addPoiToProject,
  removePoiFromProject,
}: ProjectDetailClientProps) {
  const [activeTab, setActiveTab] = useState<TabId>("details");

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-8 py-8 max-w-6xl mx-auto">
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
            <DetailsTab
              project={project}
              customers={customers}
              updateProject={updateProject}
            />
          )}
          {activeTab === "categories" && (
            <CategoriesTab
              project={project}
              createProjectCategory={createProjectCategory}
              updateProjectCategory={updateProjectCategory}
              deleteProjectCategory={deleteProjectCategory}
            />
          )}
          {activeTab === "pois" && (
            <PoisTab
              project={project}
              globalCategories={globalCategories}
              allPois={allPois}
              updateProjectPoiCategory={updateProjectPoiCategory}
              addPoiToProject={addPoiToProject}
              removePoiFromProject={removePoiFromProject}
            />
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
  const [productType, setProductType] = useState(project.product_type);
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
      formData.set("customerId", customerId);
      formData.set("name", name);
      formData.set("urlSlug", urlSlug);
      formData.set("productType", productType);
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
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 max-w-2xl">
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

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-gray-600">
            Produkttype
          </label>
          <select
            value={productType}
            onChange={(e) => setProductType(e.target.value)}
            className="w-full px-3 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-300 transition-all"
          >
            <option value="explorer">Explorer</option>
            <option value="report">Report</option>
            <option value="portrait">Guide</option>
          </select>
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
      formData.set("projectId", project.id);
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

interface PoisTabProps {
  project: ProjectWithRelations;
  globalCategories: DbCategory[];
  allPois: Array<{ id: string; name: string; category_id: string | null }>;
  updateProjectPoiCategory: (formData: FormData) => Promise<void>;
  addPoiToProject: (formData: FormData) => Promise<void>;
  removePoiFromProject: (formData: FormData) => Promise<void>;
}

function PoisTab({
  project,
  globalCategories,
  allPois,
  updateProjectPoiCategory,
  addPoiToProject,
  removePoiFromProject,
}: PoisTabProps) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedPoiId, setSelectedPoiId] = useState("");
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // POIs already in project
  const projectPoiIds = new Set(project.project_pois.map((pp) => pp.poi_id));

  // POIs available to add
  const availablePois = allPois.filter((poi) => !projectPoiIds.has(poi.id));

  const handleCategoryChange = async (
    poiId: string,
    projectCategoryId: string | null
  ) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("projectId", project.id);
      formData.set("poiId", poiId);
      if (projectCategoryId) {
        formData.set("projectCategoryId", projectCategoryId);
      }
      await updateProjectPoiCategory(formData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke oppdatere");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddPoi = async () => {
    if (!selectedPoiId) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("projectId", project.id);
      formData.set("poiId", selectedPoiId);
      await addPoiToProject(formData);
      setIsAddModalOpen(false);
      setSelectedPoiId("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke legge til POI");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemovePoi = async () => {
    if (!removeTarget) return;
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.set("projectId", project.id);
      formData.set("poiId", removeTarget);
      await removePoiFromProject(formData);
      setRemoveTarget(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke fjerne POI");
      setRemoveTarget(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const projectCategories = project.project_categories || [];
  const projectPois = project.project_pois || [];

  return (
    <div>
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">
          {projectPois.length} POI-er i prosjektet
        </p>
        <button
          onClick={() => setIsAddModalOpen(true)}
          disabled={availablePois.length === 0}
          className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-600 hover:to-emerald-700 flex items-center gap-2 text-sm font-semibold shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" /> Legg til POI
        </button>
      </div>

      {projectPois.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Ingen POI-er
          </h3>
          <p className="text-gray-500 mb-6">
            Dette prosjektet har ingen POI-er ennå.
          </p>
          {availablePois.length > 0 && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-600 hover:to-emerald-700 flex items-center gap-2 text-sm font-semibold shadow-lg shadow-emerald-500/25 transition-all mx-auto"
            >
              <Plus className="w-4 h-4" /> Legg til POI
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  POI
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Global kategori
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Prosjekt-kategori
                </th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Handlinger
                </th>
              </tr>
            </thead>
            <tbody>
              {projectPois.map((pp) => {
                const poi = pp.pois;
                const globalCategory = poi.categories;
                const projectCategory = projectCategories.find(
                  (c) => c.id === pp.project_category_id
                );
                const isOverridden = !!pp.project_category_id;

                return (
                  <tr
                    key={pp.poi_id}
                    className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                          <MapPin className="w-4 h-4 text-blue-500" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 text-sm">
                            {poi.name}
                          </div>
                          {poi.google_rating && (
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                              {poi.google_rating.toFixed(1)}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {globalCategory ? (
                        <span className="text-sm text-gray-600">
                          {globalCategory.name}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400 italic">
                          Ingen
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="relative">
                        {isOverridden && (
                          <div className="absolute -top-1.5 -right-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-medium rounded z-10">
                            Overstyrt
                          </div>
                        )}
                        <select
                          value={pp.project_category_id || ""}
                          onChange={(e) =>
                            handleCategoryChange(
                              pp.poi_id,
                              e.target.value || null
                            )
                          }
                          disabled={isSubmitting}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-300 disabled:opacity-50"
                        >
                          <optgroup label="Standard">
                            <option value="">
                              Bruk global: {globalCategory?.name || "Ingen"}
                            </option>
                          </optgroup>
                          {projectCategories.length > 0 && (
                            <optgroup label="Prosjekt-kategorier">
                              {projectCategories.map((cat) => (
                                <option key={cat.id} value={cat.id}>
                                  {cat.name}
                                </option>
                              ))}
                            </optgroup>
                          )}
                        </select>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end">
                        <button
                          onClick={() => setRemoveTarget(pp.poi_id)}
                          className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Fjern fra prosjekt"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add POI Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">
                Legg til POI
              </h2>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setSelectedPoiId("");
                }}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-gray-600">
                  Velg POI
                </label>
                <select
                  value={selectedPoiId}
                  onChange={(e) => setSelectedPoiId(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-300 transition-all"
                >
                  <option value="">Velg en POI...</option>
                  {availablePois.map((poi) => (
                    <option key={poi.id} value={poi.id}>
                      {poi.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setSelectedPoiId("");
                  }}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                >
                  Avbryt
                </button>
                <button
                  type="button"
                  onClick={handleAddPoi}
                  disabled={!selectedPoiId || isSubmitting}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Legger til...
                    </>
                  ) : (
                    "Legg til"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
