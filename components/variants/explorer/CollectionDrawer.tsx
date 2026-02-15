"use client";

import { useState, useMemo } from "react";
import type { POI } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Bookmark, Loader2, Copy, Check, X } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import Modal from "@/components/ui/Modal";

type DrawerView = "list" | "confirmation";

interface CollectionDrawerProps {
  open: boolean;
  onClose: () => void;
  collectionPOIs: string[];
  allPOIs: POI[];
  onRemove: (poiId: string) => void;
  onClearAll: () => void;
  projectId: string;
}

export default function CollectionDrawer({
  open,
  onClose,
  collectionPOIs,
  allPOIs,
  onRemove,
  onClearAll,
  projectId,
}: CollectionDrawerProps) {
  const [view, setView] = useState<DrawerView>("list");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    slug: string;
    url: string;
    emailSent: boolean;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const poiMap = useMemo(() => {
    const map = new Map<string, POI>();
    for (const poi of allPOIs) {
      map.set(poi.id, poi);
    }
    return map;
  }, [allPOIs]);

  const selectedPOIs = useMemo(() => {
    return collectionPOIs
      .map((id) => poiMap.get(id))
      .filter((poi): poi is POI => poi != null);
  }, [collectionPOIs, poiMap]);

  const getIcon = (iconName: string): LucideIcons.LucideIcon => {
    const Icon = (LucideIcons as unknown as Record<string, LucideIcons.LucideIcon>)[iconName];
    return Icon || LucideIcons.MapPin;
  };

  const handleCheckout = async () => {
    if (collectionPOIs.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          poiIds: collectionPOIs,
          email: email || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Noe gikk galt");
      }

      const data = await res.json();
      setResult(data);
      setView("confirmation");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke opprette samling");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!result?.url) return;
    try {
      await navigator.clipboard.writeText(result.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select text
    }
  };

  const handleFinish = () => {
    onClearAll();
    setView("list");
    setEmail("");
    setResult(null);
    setError(null);
    onClose();
  };

  const handleClose = view === "list" ? onClose : handleFinish;

  const title = (
    <div className="flex items-center gap-2">
      <Bookmark className="w-4 h-4 text-sky-600" />
      <h2 className="text-base font-semibold text-gray-900">
        {view === "list" ? "Min samling" : "Samlingen er klar!"}
      </h2>
    </div>
  );

  const footer = view === "list" ? (
    <button
      onClick={handleCheckout}
      disabled={loading || selectedPOIs.length === 0}
      className={cn(
        "w-full py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2",
        selectedPOIs.length > 0
          ? "bg-sky-500 text-white hover:bg-sky-600 active:bg-sky-700"
          : "bg-gray-100 text-gray-400 cursor-not-allowed"
      )}
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Oppretter samling...
        </>
      ) : (
        `Opprett min samling (${selectedPOIs.length})`
      )}
    </button>
  ) : (
    <button
      onClick={handleFinish}
      className="w-full py-3 rounded-xl text-sm font-semibold bg-gray-900 text-white hover:bg-gray-800 transition-colors"
    >
      Fortsett å utforske
    </button>
  );

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={title}
      footer={footer}
      closeOnBackdrop={view === "list"}
    >
      {view === "list" ? (
        <div className="p-4 space-y-3">
          {/* POI list */}
          {selectedPOIs.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              Ingen steder lagt til ennå
            </p>
          ) : (
            selectedPOIs.map((poi) => {
              const CategoryIcon = getIcon(poi.category.icon);
              return (
                <div
                  key={poi.id}
                  className="flex items-center gap-3 py-2"
                >
                  <div
                    className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: poi.category.color }}
                  >
                    <CategoryIcon className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {poi.name}
                    </p>
                    <p className="text-xs text-gray-500">{poi.category.name}</p>
                  </div>
                  <button
                    onClick={() => onRemove(poi.id)}
                    className="p-1.5 rounded-full hover:bg-gray-100 transition-colors flex-shrink-0"
                  >
                    <X className="w-3.5 h-3.5 text-gray-400" />
                  </button>
                </div>
              );
            })
          )}

          {/* Email input */}
          {selectedPOIs.length > 0 && (
            <div className="pt-3 border-t border-gray-100">
              <label className="text-xs text-gray-500 mb-1.5 block">
                E-post (valgfritt)
              </label>
              <input
                type="email"
                placeholder="din@epost.no"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Vi sender lenken til samlingen din
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}
        </div>
      ) : (
        /* Confirmation view */
        <div className="p-6 flex flex-col items-center text-center space-y-5">
          {/* QR Code */}
          {result?.url && (
            <div className="bg-white p-4 rounded-xl border border-gray-200">
              <QRCodeSVG
                value={result.url}
                size={180}
                level="M"
                marginSize={0}
              />
            </div>
          )}

          <p className="text-sm text-gray-600 leading-relaxed max-w-[280px]">
            Skann QR-koden for å åpne samlingen din på telefonen.
          </p>

          {/* Copy link */}
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors w-full justify-center"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-green-600" />
                Kopiert!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Kopier lenke
              </>
            )}
          </button>

          {/* Email status */}
          {email && result?.emailSent && (
            <p className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg w-full">
              Lenke sendt til {email}
            </p>
          )}
          {email && result && !result.emailSent && (
            <p className="text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded-lg w-full">
              Lenken ble ikke sendt — bruk QR-koden eller kopier lenken
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
