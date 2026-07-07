"use client";

import { useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import {
  Check,
  Link2,
  Code2,
  QrCode,
  Download,
  ExternalLink,
  ArrowLeft,
  Info,
} from "lucide-react";

/**
 * Delings-siden (Unit 3, R9/R10/R18/R19): forhåndsvisning + tre distribusjons-
 * artefakter. ALLE kjøper-vendte artefakter koder BOARD-URLen med kanal-markør
 * (R18/R19) — kjøperen lander alltid i board-opplevelsen, aldri på delings-siden:
 *   - kopier lenke      → ?src=finn
 *   - kopier iframe-kode → ?embed=1&src=embed
 *   - QR                → ?src=qr
 * Delings-side-URLen deles kun med megleren via «klart»-e-posten.
 *
 * Kopier-handlingene gir SYNLIG bekreftelse (R9) — en stille mislykket kopiering
 * av iframe-snippeten ødelegger embed-oppsettet uten at megleren merker det.
 */

interface SharePanelProps {
  /** Visningsnavn (prosjekt = hele adressen). */
  address: string;
  /** Absolutt board-URL med ?src=finn (kopier lenke + QR-payload deler board-URL). */
  boardLinkUrl: string;
  /** Absolutt board-URL med ?embed=1&src=embed (iframe-src). */
  boardEmbedUrl: string;
  /** Absolutt board-URL med ?src=qr (QR-payload). */
  boardQrUrl: string;
  /** Relativ ?embed=1-URL for same-origin forhåndsvisning (dogfooder embed-modus). */
  previewSrc: string;
  /** Anbefalt iframe-min-høyde (empirisk tunet i Unit 6). */
  recommendedHeight: number;
  /** Tilbake til kontor-siden (null for åpen-side/intern boards). */
  backHref?: string | null;
}

export default function SharePanel({
  address,
  boardLinkUrl,
  boardEmbedUrl,
  boardQrUrl,
  previewSrc,
  recommendedHeight,
  backHref,
}: SharePanelProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const qrRef = useRef<HTMLCanvasElement>(null);

  const iframeSnippet = `<iframe src="${boardEmbedUrl}" width="100%" height="${recommendedHeight}" style="border:0;border-radius:12px" title="Nabolagskart – ${address}" loading="lazy"></iframe>`;

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setFailedKey(null);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 2000);
    } catch {
      setCopiedKey(null);
      setFailedKey(key);
      setTimeout(() => setFailedKey((k) => (k === key ? null : k)), 3000);
    }
  };

  const downloadQr = () => {
    const canvas = qrRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `placy-qr-${address.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const CopyButton = ({
    text,
    itemKey,
    label,
    icon,
  }: {
    text: string;
    itemKey: string;
    label: string;
    icon: React.ReactNode;
  }) => {
    const copied = copiedKey === itemKey;
    const failed = failedKey === itemKey;
    return (
      <button
        type="button"
        onClick={() => copy(text, itemKey)}
        aria-label={label}
        className={
          "inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors " +
          (copied
            ? "bg-emerald-600 text-white"
            : failed
              ? "bg-red-50 text-red-700 border border-red-200"
              : "bg-gray-900 text-white hover:bg-gray-800")
        }
      >
        {copied ? (
          <>
            <Check className="w-4 h-4" /> Kopiert!
          </>
        ) : failed ? (
          <>
            <Info className="w-4 h-4" /> Kunne ikke kopiere
          </>
        ) : (
          <>
            {icon} {label}
          </>
        )}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="max-w-2xl mx-auto">
        {backHref && (
          <a
            href={backHref}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Lag et nytt kart
          </a>
        )}

        <h1 className="text-2xl font-bold text-gray-900 mb-1">Del nabolagskartet</h1>
        <p className="text-gray-500 mb-8 break-words">{address}</p>

        {/* Forhåndsvisning — dogfooder embed-modusen (?embed=1) */}
        <div className="rounded-xl overflow-hidden border border-gray-200 bg-white mb-8">
          <iframe
            src={previewSrc}
            title={`Forhåndsvisning – ${address}`}
            className="w-full"
            style={{ height: 420, border: 0 }}
            loading="lazy"
          />
        </div>

        {/* Kopier lenke (FINN / SMS / e-post) */}
        <section className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 mb-1">Del lenke</h2>
              <p className="text-sm text-gray-500">
                For FINN-annonsen, SMS eller e-post til kjøpere.
              </p>
            </div>
            <CopyButton
              text={boardLinkUrl}
              itemKey="link"
              label="Kopier lenke"
              icon={<Link2 className="w-4 h-4" />}
            />
          </div>
          <p className="mt-3 text-xs font-mono text-gray-400 break-all">{boardLinkUrl}</p>
        </section>

        {/* Kopier iframe-kode (kontorets objektside) */}
        <section className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 mb-1">
                Bygg inn på egen nettside
              </h2>
              <p className="text-sm text-gray-500">
                Lim iframe-koden inn på kontorets objektside.
              </p>
            </div>
            <CopyButton
              text={iframeSnippet}
              itemKey="iframe"
              label="Kopier iframe-kode"
              icon={<Code2 className="w-4 h-4" />}
            />
          </div>
          <pre className="mt-3 text-xs font-mono text-gray-500 bg-gray-50 rounded-lg p-3 overflow-x-auto">
            {iframeSnippet}
          </pre>
        </section>

        {/* QR-kode (prospekt / visning) */}
        <section className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-1.5">
                <QrCode className="w-4 h-4" /> QR-kode
              </h2>
              <p className="text-sm text-gray-500">
                For salgsprospekt eller visningsplakat.
              </p>
              <button
                type="button"
                onClick={downloadQr}
                className="mt-3 inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm bg-gray-100 text-gray-900 hover:bg-gray-200 transition-colors"
              >
                <Download className="w-4 h-4" /> Last ned QR
              </button>
            </div>
            <div className="shrink-0 rounded-lg border border-gray-100 p-2 bg-white">
              <QRCodeCanvas
                ref={qrRef}
                value={boardQrUrl}
                size={120}
                level="M"
                marginSize={2}
              />
            </div>
          </div>
        </section>

        {/* FINN-veiledning (R10 — kort, ærlig) */}
        <div className="flex gap-3 rounded-xl bg-amber-50 border border-amber-100 p-4 text-sm text-amber-900">
          <Info className="w-5 h-5 shrink-0 text-amber-500" />
          <p>
            <strong>FINN tillater ikke innebygde kart.</strong> Lim{" "}
            <em>lenken</em> inn i FINN-annonsen — via fagsystemet ditt eller i
            annonseteksten. Iframe-koden er kun for kontorets egen nettside.
          </p>
        </div>

        <a
          href={boardLinkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
        >
          <ExternalLink className="w-4 h-4" />
          Åpne kartet i ny fane
        </a>
      </div>
    </div>
  );
}
