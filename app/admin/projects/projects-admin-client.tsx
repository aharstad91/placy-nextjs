"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Plus,
  Edit2,
  Trash2,
  X,
  Loader2,
  FolderOpen,
  ExternalLink,
  Filter,
  BookOpen,
} from "lucide-react";
import type { DbProject, DbCustomer } from "@/lib/supabase/types";
import { ConfirmDialog } from "@/components/admin";

type ProjectWithCustomerName = DbProject & { customerName: string };

interface ProjectsAdminClientProps {
  projects: ProjectWithCustomerName[];
  customers: Pick<DbCustomer, "id" | "name">[];
  createProject: (formData: FormData) => Promise<void>;
  updateProject: (formData: FormData) => Promise<void>;
  deleteProject: (formData: FormData) => Promise<void>;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[æ]/g, "ae")
    .replace(/[ø]/g, "o")
    .replace(/[å]/g, "a")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function ProjectsAdminClient({
  projects,
  customers,
  createProject,
  updateProject,
  deleteProject,
}: ProjectsAdminClientProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectWithCustomerName | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectWithCustomerName | null>(null);
  const [filterCustomerId, setFilterCustomerId] = useState<string>("");

  // Form state
  const [customerId, setCustomerId] = useState("");
  const [name, setName] = useState("");
  const [urlSlug, setUrlSlug] = useState("");
  const [productType, setProductType] = useState("explorer");
  const [centerLat, setCenterLat] = useState("63.4305");
  const [centerLng, setCenterLng] = useState("10.3951");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  // Filter projects by customer
  const filteredProjects = useMemo(() => {
    if (!filterCustomerId) return projects;
    return projects.filter((p) => p.customer_id === filterCustomerId);
  }, [projects, filterCustomerId]);

  const openCreateModal = () => {
    setEditingProject(null);
    setCustomerId(customers[0]?.id || "");
    setName("");
    setUrlSlug("");
    setProductType("explorer");
    setCenterLat("63.4305");
    setCenterLng("10.3951");
    setSlugManuallyEdited(false);
    setError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (project: ProjectWithCustomerName) => {
    setEditingProject(project);
    setCustomerId(project.customer_id || "");
    setName(project.name);
    setUrlSlug(project.url_slug);
    setProductType(project.product_type || "explorer");
    setCenterLat(project.center_lat.toString());
    setCenterLng(project.center_lng.toString());
    setSlugManuallyEdited(true);
    setError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProject(null);
    setError(null);
  };

  const handleNameChange = (newName: string) => {
    setName(newName);
    if (!slugManuallyEdited) {
      setUrlSlug(slugify(newName));
    }
  };

  const handleSlugChange = (newSlug: string) => {
    setUrlSlug(newSlug);
    setSlugManuallyEdited(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerId) {
      setError("Velg en kunde");
      return;
    }

    if (!name.trim()) {
      setError("Navn er påkrevd");
      return;
    }

    if (!urlSlug.trim()) {
      setError("URL-slug er påkrevd");
      return;
    }

    const lat = parseFloat(centerLat);
    const lng = parseFloat(centerLng);

    if (isNaN(lat) || isNaN(lng)) {
      setError("Ugyldige koordinater");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      if (editingProject) {
        formData.set("id", editingProject.id);
      }
      formData.set("customerId", customerId);
      formData.set("name", name);
      formData.set("urlSlug", urlSlug);
      formData.set("productType", productType);
      formData.set("centerLat", lat.toString());
      formData.set("centerLng", lng.toString());

      if (editingProject) {
        await updateProject(formData);
      } else {
        await createProject(formData);
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
    setError(null);

    try {
      const formData = new FormData();
      formData.set("id", deleteTarget.id);
      await deleteProject(formData);
      setDeleteTarget(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke slette");
      setDeleteTarget(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Prosjekter</h1>
            <p className="text-sm text-gray-500">
              {filteredProjects.length} prosjekt{filteredProjects.length !== 1 && "er"}
              {filterCustomerId && " (filtrert)"}
            </p>
          </div>
          <button
            onClick={openCreateModal}
            className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-600 hover:to-emerald-700 flex items-center gap-2 text-sm font-semibold shadow-lg shadow-emerald-500/25 transition-all"
          >
            <Plus className="w-4 h-4" />
            Nytt prosjekt
          </button>
        </div>

        {/* Filter */}
        <div className="mb-4 flex items-center gap-3">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={filterCustomerId}
            onChange={(e) => setFilterCustomerId(e.target.value)}
            className="px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/50 focus:border-blue-300"
          >
            <option value="">Alle kunder</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
          {filterCustomerId && (
            <button
              onClick={() => setFilterCustomerId("")}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Fjern filter
            </button>
          )}
        </div>

        {/* Error banner */}
        {error && !isModalOpen && (
          <div className="mb-4 p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Navn
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Kunde
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  URL Slug
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Koordinater
                </th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Handlinger
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">
                      {filterCustomerId
                        ? "Ingen prosjekter for denne kunden"
                        : "Ingen prosjekter ennå"}
                    </p>
                    {!filterCustomerId && (
                      <button
                        onClick={openCreateModal}
                        className="mt-3 text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                      >
                        Opprett ditt første prosjekt
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredProjects.map((project) => (
                  <tr
                    key={project.id}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                          <FolderOpen className="w-4 h-4 text-blue-500" />
                        </div>
                        <span className="text-sm font-medium text-gray-900">
                          {project.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {project.customerName}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600">
                          {project.url_slug}
                        </code>
                        <Link
                          href={`/${project.customer_id}/${project.url_slug}`}
                          target="_blank"
                          className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
                          title="Åpne prosjekt"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600 capitalize">
                        {project.product_type || "explorer"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs font-mono text-gray-500">
                      {project.center_lat.toFixed(4)}, {project.center_lng.toFixed(4)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/admin/projects/${project.id}/story`}
                          className="p-2 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="Story Editor"
                        >
                          <BookOpen className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => openEditModal(project)}
                          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Rediger"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(project)}
                          className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Slett"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingProject ? "Rediger prosjekt" : "Nytt prosjekt"}
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
                  Kunde *
                </label>
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-300 transition-all"
                >
                  <option value="">Velg kunde...</option>
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
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-300 transition-all"
                  placeholder="F.eks. Ferjemannsveien 10"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-gray-600">
                  URL Slug *
                </label>
                <input
                  type="text"
                  value={urlSlug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-300 transition-all font-mono"
                  placeholder="ferjemannsveien-10"
                />
                <p className="text-xs text-gray-400">
                  Brukes i URL: /{customerId || "kunde"}/{urlSlug || "prosjekt"}
                </p>
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
                    placeholder="63.4305"
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
                    placeholder="10.3951"
                  />
                </div>
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
                  ) : editingProject ? (
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
        title="Slett prosjekt"
        message={`Er du sikker på at du vil slette prosjektet "${deleteTarget?.name}"? Dette vil også slette alle tilknyttede stories, seksjoner og POI-koblinger.`}
        confirmLabel="Slett alt"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
