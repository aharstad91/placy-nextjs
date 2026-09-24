import type { Metadata } from "next";
import Image from "next/image";
import Arrow from "@/app/demo/nyhavna-nettside/arrow";
import { nhChatEnabled } from "@/lib/demo/nyhavna-chat/access";

export const metadata: Metadata = {
  title: "Beliggenhet – Nyhavna",
  description:
    "Bli kjent med Nyhavna og alt du finner i nærheten. Utforsk nabolaget med Placy.",
  robots: { index: false, follow: false },
};

export default function BeliggenhetPage() {
  return (
    <main id="main-content" className="demo-location site-width" data-placy-page-id="beliggenhet">
      <nav className="demo-breadcrumb" aria-label="Brødsmuler">
        <a href="/demo/nyhavna-nettside">Forside</a>
        <span aria-hidden="true">/</span>
        <span>Beliggenhet</span>
      </nav>
      <section className="demo-location-hero">
        <div className="demo-location-copy">
          <p className="demo-eyebrow">Beliggenhet</p>
          <h1>
            En hel bydel.
            <br />
            Rett i nærheten.
          </h1>
          <p className="demo-location-intro">
            Fjorden, byen og hverdagen møtes på Nyhavna. Her er det mye å
            oppdage – fra kaféer og kultur til turstier og små favorittsteder.
          </p>
          <p>
            Med vår digitale nabolagsguide Placy kan du utforske kartet og
            spørre om det du er nysgjerrig på. Bli kjent med Nyhavna, i ditt
            eget tempo.
          </p>
          <a
            className="demo-placy-button"
            href="/demo/nyhavna-lokal"
            target="_blank"
            rel="noopener noreferrer"
          >
            Utforsk Nyhavna med Placy <Arrow />
          </a>
          <span className="demo-new-tab">Åpnes i en ny fane</span>
          {nhChatEnabled() ? (
            // Åpner chatboksen med et første spørsmål (widgetens delegerte åpning).
            <button
              type="button"
              className="demo-chat-button"
              data-placy-chat-open=""
              data-placy-chat-question="Hva finnes i nærområdet i dag?"
            >
              Spør om nabolaget
            </button>
          ) : null}
        </div>
        <a
          className="demo-location-image"
          href="/demo/nyhavna-lokal"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Utforsk Nyhavna med Placy – åpnes i en ny fane"
        >
          <Image
            src="/demo/nyhavna-nettside/nyhavna-aerial.jpg"
            alt="Nyhavna og havnebassenget sett fra luften"
            width={1200}
            height={1000}
            priority
          />
          <span className="demo-image-caption">
            Bli kjent med nabolaget <Arrow />
          </span>
        </a>
      </section>
    </main>
  );
}
