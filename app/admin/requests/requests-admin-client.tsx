"use client";

import { useState } from "react";
import type { DbGenerationRequest } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import { ExternalLink, RotateCcw, Loader2 } from "lucide-react";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  processing: "bg-blue-100 text-blue-800",
  completed: "bg-emerald-100 text-emerald-800",
  failed: "bg-red-100 text-red-800",
};

const HOUSING_LABELS: Record<string, string> = {
  family: "Familie",
  young: "Ung",
  senior: "Senior",
};

interface Props {
  requests: DbGenerationRequest[];
}

export default function RequestsAdminClient({ requests: initialRequests }: Props) {
  const [requests, setRequests] = useState(initialRequests);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const handleRetry = async (id: string) => {
    setRetryingId(id);
    try {
      const res = await fetch("/api/admin/retry-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setRequests((prev) =>
          prev.map((r) =>
            r.id === id
              ? { ...r, status: "pending" as const, error_message: null }
              : r
          )
        );
      }
    } catch {
      // ignore
    } finally {
      setRetryingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("nb-NO", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Adresse</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Epost</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Opprettet</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">URL</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Handling</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {requests.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                Ingen forespørsler ennå
              </td>
            </tr>
          )}
          {requests.map((req) => (
            <tr key={req.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate" title={req.address}>
                {req.address}
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">{req.email}</td>
              <td className="px-4 py-3 text-sm text-gray-600">
                {HOUSING_LABELS[req.housing_type] ?? req.housing_type}
              </td>
              <td className="px-4 py-3">
                <span
                  className={cn(
                    "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                    STATUS_STYLES[req.status]
                  )}
                  title={req.error_message ?? undefined}
                >
                  {req.status}
                </span>
                {req.error_message && (
                  <p className="text-xs text-red-500 mt-1 max-w-xs truncate" title={req.error_message}>
                    {req.error_message}
                  </p>
                )}
              </td>
              <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                {formatDate(req.created_at)}
              </td>
              <td className="px-4 py-3 text-sm">
                {req.status === "completed" && req.result_url ? (
                  <a
                    href={req.result_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Åpne
                  </a>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-sm">
                {req.status === "failed" && (
                  <button
                    onClick={() => handleRetry(req.id)}
                    disabled={retryingId === req.id}
                    className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 text-sm disabled:opacity-50"
                  >
                    {retryingId === req.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="w-3.5 h-3.5" />
                    )}
                    Prøv igjen
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
