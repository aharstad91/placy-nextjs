"use client";

import { useState } from "react";
import { Bookmark, Loader2, Copy, Check, X, MapPin } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import Modal from "@/components/ui/Modal";
import { cn } from "@/lib/utils";
import type { BoardPOI } from "../board-data";

type DrawerView = "list" | "confirmation";

/**
 * Event-board "Min samling"-drawer (Unit 5). Minimal port av explorer-ens
 * `CollectionDrawer` inn i board-verdenen — board hadde ingen collection-UI.
 *
 * Forskjell fra explorer-versjonen: del-URLen bygges på BOARD-ruten
 * (`window.location` + `?c=<slug>`), ikke rot-URLen som `/api/collections`
 * returnerer (den peker på Explorer-roten). Slik reproduserer en delt lenke
 * samlingen i event-board-ruten, ikke i Explorer.
 */
export function BoardCollectionDrawer({
  open,
  onClose,
  collectionPois,
  onRemove,
  projectId,
}: {
  open: boolean;
  onClose: () => void;
  /** De lagrede event-POIene (allerede resolvert fra collection-IDene). */
  collectionPois: BoardPOI[];
  onRemove: (poiId: string) => void;
  projectId: string;
}) {
  const [view, setView] = useState<DrawerView>("list");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ slug: string; url: string } | null>(
    null,
  );
  const [copied, setCopied] = useState(false);

  const handleCheckout = async () => {
    if (collectionPois.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          poiIds: collectionPois.map((p) => p.id),
          email: email || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Noe gikk galt");
      }
      const data: { slug: string } = await res.json();
      // Board-rute-URL: behold gjeldende sti, sett kun `?c=<slug>`. API-ens
      // egen `url` peker på Explorer-roten og ville sendt mottakeren til feil
      // produkt.
      const boardUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}${window.location.pathname}?c=${data.slug}`
          : `?c=${data.slug}`;
      setResult({ slug: data.slug, url: boardUrl });
      setView("confirmation");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Kunne ikke opprette samling",
      );
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
      // no-op: brukeren kan bruke QR-koden i stedet
    }
  };

  // Lukk dialogen og nullstill den flyktige drawer-tilstanden (view/e-post/
  // resultat/feil) — men BEHOLD samlingen. Å lukke "Samlingen er klar!" (via
  // «Fortsett å utforske», X eller Escape) skal IKKE slette brukerens events;
  // delingen er en ikke-destruktiv handling.
  const handleFinish = () => {
    setView("list");
    setEmail("");
    setResult(null);
    setError(null);
    onClose();
  };

  const handleClose = view === "list" ? onClose : handleFinish;

  const title = (
    <div className="flex items-center gap-2">
      <Bookmark className="h-4 w-4 text-sky-600" />
      <h2 className="text-base font-semibold text-gray-900">
        {view === "list" ? "Min samling" : "Samlingen er klar!"}
      </h2>
    </div>
  );

  const footer =
    view === "list" ? (
      <button
        onClick={handleCheckout}
        disabled={loading || collectionPois.length === 0}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all",
          collectionPois.length > 0
            ? "bg-sky-500 text-white hover:bg-sky-600 active:bg-sky-700"
            : "cursor-not-allowed bg-gray-100 text-gray-400",
        )}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Oppretter samling...
          </>
        ) : (
          `Del min samling (${collectionPois.length})`
        )}
      </button>
    ) : (
      <button
        onClick={handleFinish}
        className="w-full rounded-xl bg-gray-900 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
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
        <div className="space-y-3 p-4">
          {collectionPois.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">
              Ingen arrangementer lagt til ennå
            </p>
          ) : (
            collectionPois.map((poi) => {
              const time = poi.eventTimeStart
                ? poi.eventTimeEnd
                  ? `${poi.eventTimeStart}–${poi.eventTimeEnd}`
                  : poi.eventTimeStart
                : null;
              return (
                <div key={poi.id} className="flex items-center gap-3 py-2">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white"
                    style={{ backgroundColor: poi.raw.category.color ?? "#0ea5e9" }}
                  >
                    <MapPin className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {poi.name}
                    </p>
                    {time && <p className="text-xs text-gray-500">{time}</p>}
                  </div>
                  <button
                    onClick={() => onRemove(poi.id)}
                    aria-label={`Fjern ${poi.name}`}
                    className="shrink-0 rounded-full p-1.5 transition-colors hover:bg-gray-100"
                  >
                    <X className="h-3.5 w-3.5 text-gray-400" />
                  </button>
                </div>
              );
            })
          )}

          {collectionPois.length > 0 && (
            <div className="border-t border-gray-100 pt-3">
              <label className="mb-1.5 block text-xs text-gray-500">
                E-post (valgfritt)
              </label>
              <input
                type="email"
                placeholder="din@epost.no"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <p className="mt-1 text-[11px] text-gray-400">
                Vi sender lenken til samlingen din
              </p>
            </div>
          )}

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center space-y-5 p-6 text-center">
          {result?.url && (
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <QRCodeSVG value={result.url} size={180} level="M" marginSize={0} />
            </div>
          )}
          <p className="max-w-[280px] text-sm leading-relaxed text-gray-600">
            Skann QR-koden for å åpne samlingen din på telefonen.
          </p>
          <button
            onClick={handleCopyLink}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-green-600" />
                Kopiert!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Kopier lenke
              </>
            )}
          </button>
        </div>
      )}
    </Modal>
  );
}
