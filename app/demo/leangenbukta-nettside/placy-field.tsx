import Arrow from "@/app/demo/leangenbukta-nettside/arrow";
import { PLACY_BOARD } from "@/app/demo/leangenbukta-nettside/placy-row";

/**
 * Placy-feltene i Leangenbukta-kopien (2026-09-23).
 *
 * ## Én visuell form, tre plasseringer
 *
 * Feltet bruker kundens egne klasser (`wpb_row`, `nectar-button`) og
 * sandfargen fra forsidens kartseksjon, så det ser ut som noe Leangenbukta
 * kunne ha publisert selv. Avsenderen er prosjektet; «Drevet av Placy» står
 * diskret ved selve opplevelsen.
 *
 * - `building` står høyt på hver byggside, rett etter byggidentiteten og før
 *   de lange salgsdetaljene.
 * - `location` står øverst på Beliggenhet, under kundens eget kart.
 * - `intro` er forsidens tidlige inngang, som knytter beliggenhet til
 *   kjøpsspørsmål.
 * - `article` er en nøktern videre-lenke nederst på relevante artikler og
 *   prosjektsider.
 *
 * ## Hva feltet IKKE sier
 *
 * Ingen reisetid, avstand eller tilgang til fasiliteter for det konkrete
 * bygget: det finnes ikke kontrollert byggspesifikt datagrunnlag. Feltet
 * beskriver hva man kan gjøre (utforske kartet, spørre), og chatten svarer
 * ut fra Placys kontrollerte kunnskap om prosjektet.
 *
 * Den sekundære knappen åpner tekstchatten via widgetens delegerte
 * `data-placy-chat-open` (public/embed/placy-chat.js), med et forslag til
 * spørsmål om akkurat denne siden.
 */

type Variant = "building" | "location" | "intro" | "article";

interface Props {
  variant: Variant;
  /** Byggets navn slik siden selv skriver det, f.eks. «Knutepunktet». */
  name?: string;
  /** Spørsmålet chatten åpnes med. */
  question: string;
}

const COPY: Record<Variant, (name?: string) => { heading: string; body: string; chat: string }> = {
  building: (name) => ({
    heading: `Hverdagen rundt ${name}`,
    body: "Se skolene, butikkene, Ladestien og kollektivtilbudet rundt Leangenbukta på kartet – og hvor lang tid du bruker dit. Eller spør om bygget og nærområdet, og få svar med kilde.",
    chat: `Spør om ${name}`,
  }),
  location: () => ({
    heading: "Utforsk nabolaget rundt Leangenbukta",
    body: "Kartet over viser hvor prosjektet ligger. Her kan du gå inn i nabolaget: skolene, butikkene, Ladestien og kollektivtilbudet – og hvor lang tid du bruker dit til fots, på sykkel eller med bil.",
    chat: "Spør om nærområdet",
  }),
  intro: () => ({
    heading: "Hvordan er det å bo her?",
    body: "Utforsk skoler, butikker, turområder og kollektivtilbud rundt Leangenbukta, eller still et spørsmål om prosjektet og nabolaget.",
    chat: "Still et spørsmål",
  }),
  article: () => ({
    heading: "Utforsk nabolaget rundt Leangenbukta",
    body: "Kartet viser hva som ligger rundt prosjektet, med reisetid til fots, på sykkel og med bil.",
    chat: "Spør om nærområdet",
  }),
};

export function PlacyField({ variant, name, question }: Props) {
  const copy = COPY[variant](name);
  return (
    <div
      data-column-margin="default"
      data-midnight="dark"
      className={`wpb_row vc_row-fluid vc_row full-width-content vc_row-o-equal-height vc_row-flex vc_row-o-content-top demo-placy-field demo-placy-field--${variant}`}
      style={{ paddingTop: "10px", paddingBottom: "10px" }}
    >
      <div className="row_col_wrap_12 col span_12 dark left">
        <div
          style={{ color: "#2a2c2e" }}
          className="vc_col-sm-12 wpb_column column_container vc_column_container col padding-4-percent inherit_tablet inherit_phone"
        >
          <div className="vc_column-inner">
            <div className="wpb_wrapper demo-placy-block">
              <section aria-label={copy.heading}>
                <h3 className="demo-placy-heading">
                  <strong>{copy.heading}</strong>
                </h3>
                <p className="demo-placy-body">{copy.body}</p>
                <div className="demo-placy-actions">
                  <a
                    className="nectar-button medium regular extra-color-2 has-icon regular-button"
                    role="button"
                    href={PLACY_BOARD}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span>Utforsk nabolaget</span>
                    <Arrow />
                  </a>
                  <button
                    type="button"
                    className="nectar-button medium regular regular-button demo-placy-chat-button"
                    data-placy-chat-open=""
                    data-placy-chat-question={question}
                  >
                    <span>{copy.chat}</span>
                  </button>
                </div>
                <p className="demo-placy-note">
                  Kartet åpnes i en ny fane · <span>Drevet av Placy</span>
                </p>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
