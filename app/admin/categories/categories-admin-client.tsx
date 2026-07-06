"use client";

import { useMemo, useState } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  X,
  Loader2,
  Tag,
  MapPin,
  Search,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from "lucide-react";
import type { TablesV2 } from "@/lib/supabase/types";

type DbCategory = TablesV2<"categories">;
import { ConfirmDialog, IconPicker, ColorPicker, ICON_MAP } from "@/components/admin";

type CategoryWithCount = DbCategory & { poiCount: number };

type SortColumn = "name" | "poiCount";
type SortDirection = "asc" | "desc";

interface CategoriesAdminClientProps {
  categories: CategoryWithCount[];
  createCategory: (formData: FormData) => Promise<void>;
  updateCategory: (formData: FormData) => Promise<void>;
  deleteCategory: (formData: FormData) => Promise<void>;
}

export function CategoriesAdminClient({
  categories,
  createCategory,
  updateCategory,
  deleteCategory,
}: CategoriesAdminClientProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryWithCount | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CategoryWithCount | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("MapPin");
  const [color, setColor] = useState("#3b82f6");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search / sort / filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [sortColumn, setSortColumn] = useState<SortColumn>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [onlyInUse, setOnlyInUse] = useState(false);

  const isFiltered = searchQuery.trim().length > 0 || onlyInUse;

  const visibleCategories = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const filtered = categories.filter((category) => {
      if (query && !category.name.toLowerCase().includes(query)) {
        return false;
      }
      if (onlyInUse && category.poiCount === 0) {
        return false;
      }
      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      const comparison =
        sortColumn === "name"
          ? a.name.localeCompare(b.name, "nb")
          : a.poiCount - b.poiCount;
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [categories, searchQuery, onlyInUse, sortColumn, sortDirection]);

  const toggleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const renderSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-gray-300" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="w-3.5 h-3.5 text-gray-600" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-gray-600" />
    );
  };

  const openCreateModal = () => {
    setEditingCategory(null);
    setName("");
    setIcon("MapPin");
    setColor("#3b82f6");
    setError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (category: CategoryWithCount) => {
    setEditingCategory(category);
    setName(category.name);
    setIcon(category.icon);
    setColor(category.color);
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

    if (!name.trim()) {
      setError("Navn er påkrevd");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      if (editingCategory) {
        formData.set("id", editingCategory.id);
      }
      formData.set("name", name);
      formData.set("icon", icon);
      formData.set("color", color);

      if (editingCategory) {
        await updateCategory(formData);
      } else {
        await createCategory(formData);
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
      await deleteCategory(formData);
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
            <h1 className="text-2xl font-bold text-gray-900">Kategorier</h1>
            <p className="text-sm text-gray-500">
              {isFiltered
                ? `${visibleCategories.length} av ${categories.length} kategori${categories.length !== 1 ? "er" : ""}`
                : `${categories.length} kategori${categories.length !== 1 ? "er" : ""}`}
            </p>
          </div>
          <button
            onClick={openCreateModal}
            className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-600 hover:to-emerald-700 flex items-center gap-2 text-sm font-semibold shadow-lg shadow-emerald-500/25 transition-all"
          >
            <Plus className="w-4 h-4" />
            Ny kategori
          </button>
        </div>

        {/* Error banner */}
        {error && !isModalOpen && (
          <div className="mb-4 p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm">
            {error}
          </div>
        )}

        {/* Toolbar: search + filter */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Søk etter kategorinavn..."
              className="w-full pl-9 pr-3 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-300 transition-all"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 select-none cursor-pointer">
            <input
              type="checkbox"
              checked={onlyInUse}
              onChange={(e) => setOnlyInUse(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500/50"
            />
            Kun i bruk
          </label>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Ikon
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <button
                    onClick={() => toggleSort("name")}
                    className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                  >
                    Navn
                    {renderSortIcon("name")}
                  </button>
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Farge
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <button
                    onClick={() => toggleSort("poiCount")}
                    className="flex items-center gap-1 hover:text-gray-700 transition-colors"
                  >
                    POI-er
                    {renderSortIcon("poiCount")}
                  </button>
                </th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Handlinger
                </th>
              </tr>
            </thead>
            <tbody>
              {categories.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <Tag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">Ingen kategorier ennå</p>
                    <button
                      onClick={openCreateModal}
                      className="mt-3 text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                    >
                      Opprett din første kategori
                    </button>
                  </td>
                </tr>
              ) : visibleCategories.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">Ingen kategorier matcher søket</p>
                  </td>
                </tr>
              ) : (
                visibleCategories.map((category) => {
                  const IconComponent = ICON_MAP[category.icon] || MapPin;
                  return (
                    <tr
                      key={category.id}
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: category.color }}
                        >
                          <IconComponent className="w-4 h-4 text-white" />
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm font-medium text-gray-900">
                        {category.name}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded-full border border-gray-200"
                            style={{ backgroundColor: category.color }}
                          />
                          <span className="text-xs font-mono text-gray-500">
                            {category.color}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-500">
                        {category.poiCount}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditModal(category)}
                            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Rediger"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(category)}
                            className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Slett"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
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
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-300 transition-all"
                  placeholder="F.eks. Restaurant"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-gray-600">
                  Ikon *
                </label>
                <IconPicker value={icon} onChange={setIcon} />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-gray-600">
                  Farge *
                </label>
                <ColorPicker value={color} onChange={setColor} />
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
        message={
          deleteTarget?.poiCount
            ? `Kategorien "${deleteTarget.name}" brukes av ${deleteTarget.poiCount} POI${deleteTarget.poiCount > 1 ? "-er" : ""}. Du må flytte disse til en annen kategori før du kan slette.`
            : `Er du sikker på at du vil slette kategorien "${deleteTarget?.name}"?`
        }
        confirmLabel="Slett"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
