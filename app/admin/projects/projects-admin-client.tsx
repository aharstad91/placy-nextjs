"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  X,
  Loader2,
  FolderOpen,
  ExternalLink,
  Filter,
  Compass,
  FileText,
  Map,
  Package,
} from "lucide-react";
import type { DbCustomer } from "@/lib/supabase/types";
import { ConfirmDialog } from "@/components/admin";
import { slugify } from "@/lib/utils/slugify";

// Product in a container
interface ProductInfo {
  id: string;
  type: "explorer" | "report" | "guide";
  title: string | null;
  filePath?: string;
}

// Container (project) with products
interface ProjectContainer {
  id: string;
  short_id?: string;
  name: string;
  customer_id: string;
  url_slug: string;
  center_lat: number;
  center_lng: number;
  customerName: string;
  source: "supabase" | "json";
  products: ProductInfo[];
}

interface ProjectsAdminClientProps {
  containers: ProjectContainer[];
  customers: Pick<DbCustomer, "id" | "name">[];
  createProject: (formData: FormData) => Promise<void>;
  deleteProject: (formData: FormData) => Promise<void>;
}

const productIcons = {
  explorer: Compass,
  report: FileText,
  guide: Map,
};

const productLabels = {
  explorer: "Explorer",
  report: "Report",
  guide: "Guide",
};

const productColors = {
  explorer: "text-blue-600 bg-blue-50",
  report: "text-purple-600 bg-purple-50",
  guide: "text-amber-600 bg-amber-50",
};

export function ProjectsAdminClient({
  containers,
  customers,
  createProject,
  deleteProject,
}: ProjectsAdminClientProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    container: ProjectContainer;
    product?: ProductInfo;
  } | null>(null);
  const [filterCustomerId, setFilterCustomerId] = useState<string>("");

  // Form state for create modal
  const [customerId, setCustomerId] = useState("");
  const [name, setName] = useState("");
  const [urlSlug, setUrlSlug] = useState("");
  const [productType, setProductType] = useState("explorer");
  const [centerLat, setCenterLat] = useState("63.4305");
  const [centerLng, setCenterLng] = useState("10.3951");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  // Filter containers by customer
  const filteredContainers = useMemo(() => {
    if (!filterCustomerId) return containers;
    return containers.filter((c) => c.customer_id === filterCustomerId);
  }, [containers, filterCustomerId]);

  const openCreateModal = () => {
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

  const closeModal = () => {
    setIsModalOpen(false);
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
      formData.set("customerId", customerId);
      formData.set("name", name);
      formData.set("urlSlug", urlSlug);
      formData.set("productType", productType);
      formData.set("centerLat", lat.toString());
      formData.set("centerLng", lng.toString());

      await createProject(formData);
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
      if (deleteTarget.product) {
        // Delete single product
        formData.set("id", deleteTarget.product.id);
        formData.set("type", "product");
      } else {
        // Delete entire container
        formData.set("id", deleteTarget.container.id);
        formData.set("type", "container");
      }
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
              {filteredContainers.length} prosjekt
              {filteredContainers.length !== 1 && "er"}
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

        {/* Container List */}
        <div className="space-y-3">
          {filteredContainers.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 py-12 text-center">
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
            </div>
          ) : (
            filteredContainers.map((container) => {
              const canNavigate =
                container.source === "supabase" && container.short_id;

              return (
                <div
                  key={container.id}
                  className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden ${
                    canNavigate
                      ? "cursor-pointer hover:bg-gray-50 hover:border-gray-300 transition-colors"
                      : ""
                  }`}
                  onClick={
                    canNavigate
                      ? () =>
                          router.push(`/admin/projects/${container.short_id}`)
                      : undefined
                  }
                >
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg flex items-center justify-center">
                        <Package className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900">
                          {container.name}
                        </h3>
                        <p className="text-xs text-gray-500">
                          {container.customerName} ·{" "}
                          <code className="bg-gray-100 px-1 rounded">
                            {container.url_slug}
                          </code>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Product badges */}
                      <div className="flex items-center gap-1.5">
                        {container.products.map((product) => {
                          const Icon = productIcons[product.type];
                          return (
                            <span
                              key={product.id}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${
                                productColors[product.type]
                              }`}
                              title={productLabels[product.type]}
                            >
                              <Icon className="w-3 h-3" />
                              {productLabels[product.type]}
                            </span>
                          );
                        })}
                        {container.source === "json" && (
                          <span className="text-xs bg-amber-100 px-2 py-1 rounded-md text-amber-700 font-medium">
                            JSON
                          </span>
                        )}
                      </div>

                      {/* External link */}
                      <Link
                        href={`/${container.customer_id}/${container.url_slug}`}
                        target="_blank"
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Åpne prosjekt"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Link>

                      {/* Delete container */}
                      {container.source === "supabase" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget({ container });
                          }}
                          className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Slett prosjekt"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">
                Nytt prosjekt
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
                  placeholder="F.eks. Quality Hotel Augustin"
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
                  placeholder="quality-hotel-augustin"
                />
                <p className="text-xs text-gray-400">
                  URL: /{customerId || "kunde"}/{urlSlug || "prosjekt"}
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-gray-600">
                  Første produkt
                </label>
                <select
                  value={productType}
                  onChange={(e) => setProductType(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-300 transition-all"
                >
                  <option value="explorer">Explorer</option>
                  <option value="report">Report</option>
                  <option value="guide">Guide</option>
                </select>
                <p className="text-xs text-gray-400">
                  Du kan legge til flere produkter senere
                </p>
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
                      Oppretter...
                    </>
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
        title={
          deleteTarget?.product ? "Slett produkt" : "Slett prosjekt"
        }
        message={
          deleteTarget?.product
            ? `Er du sikker på at du vil slette ${
                productLabels[deleteTarget.product.type]
              } fra "${deleteTarget.container.name}"?`
            : `Er du sikker på at du vil slette prosjektet "${deleteTarget?.container.name}" og alle tilhørende produkter?`
        }
        confirmLabel="Slett"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
