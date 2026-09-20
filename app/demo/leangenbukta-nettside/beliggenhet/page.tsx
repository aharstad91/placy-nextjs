import type { Metadata } from "next";
import Image from "next/image";
import Arrow from "@/app/demo/leangenbukta-nettside/arrow";
import { PLACY_BOARD } from "@/app/demo/leangenbukta-nettside/placy-row";

const BASE = "/demo/leangenbukta-nettside";

export const metadata: Metadata = {
  title: "Beliggenhet – Leangenbukta",
  description:
    "Leangenbukta ligger mellom fjorden, Ladestien og kollektivknutepunktet på Leangen. Utforsk nabolaget med Placy.",
  robots: { index: false, follow: false },
};

/**
 * Beliggenhetssiden — den ene nye siden i replikaen.
 *
 * Teksten er bygd på kundens eget språk fra `/om-prosjektet/#beliggenhet` og
 * fra forsidens «En del av Ladestien, fjæra og kulturlandskapet». Markupen
 * bruker de samme Salient-klassene som resten av siden, så siden ser ut som en
 * side kunden kunne ha publisert selv.
 */
export default function BeliggenhetPage() {
  return (
    <div className="container-wrap">
      <div className="container main-content" role="main">
        <div className="row">
          <div
            id="beliggenhet"
            data-column-margin="default"
            data-midnight="dark"
            className="wpb_row vc_row-fluid vc_row full-width-content vc_row-o-equal-height vc_row-flex vc_row-o-content-top"
            style={{ paddingTop: "0px", paddingBottom: "0px" }}
          >
            <div className="row-bg-wrap" data-bg-animation="none" data-bg-overlay="false">
              <div className="inner-wrap row-bg-layer">
                <div className="row-bg viewport-desktop"></div>
              </div>
            </div>
            <div className="row_col_wrap_12 col span_12 dark left">
              <div
                style={{ color: "#ffffff" }}
                className="vc_col-sm-6 border-right wpb_column column_container vc_column_container col no-extra-padding inherit_tablet inherit_phone"
                data-cfc="true"
                data-using-bg="true"
                data-bg-cover="true"
                data-padding-pos="all"
              >
                <div className="vc_column-inner">
                  <div
                    className="column-image-bg-wrap column-bg-layer viewport-desktop"
                    data-bg-pos="center center"
                    data-bg-animation="none"
                    data-bg-overlay="false"
                  >
                    <div className="inner-wrap">
                      <div
                        className="column-image-bg"
                        style={{
                          backgroundImage: `url('${BASE}/Leangenbukta_Eksterior_Drone-004_v3_3destate.no_-f22318.jpg')`,
                        }}
                      ></div>
                    </div>
                  </div>
                  <div className="wpb_wrapper"></div>
                </div>
              </div>
              <div
                style={{ color: "#2a2c2e" }}
                className="vc_col-sm-6 border-left wpb_column column_container vc_column_container col padding-6-percent inherit_tablet inherit_phone"
                data-cfc="true"
                data-using-bg="true"
                data-padding-pos="all"
                data-has-bg-color="true"
                data-bg-color="#d6c6b7"
                data-bg-opacity="1"
              >
                <div className="vc_column-inner">
                  <div className="column-bg-overlay-wrap column-bg-layer" data-bg-animation="none">
                    <div className="column-bg-overlay" style={{ opacity: 1, backgroundColor: "#d6c6b7" }}></div>
                  </div>
                  <div className="wpb_wrapper">
                    <nav className="demo-breadcrumb" aria-label="Brødsmuler">
                      <a href={BASE} data-no-transition>
                        Forside
                      </a>
                      <span aria-hidden="true">/</span>
                      <span>Beliggenhet</span>
                    </nav>
                    <div className="wpb_text_column wpb_content_element">
                      <h3>
                        <strong>Mellom fjorden, Ladestien og togstasjonen</strong>
                      </h3>
                    </div>
                    <div className="divider-wrap" data-alignment="default">
                      <div style={{ height: "15px" }} className="divider"></div>
                    </div>
                    <div className="wpb_text_column wpb_content_element">
                      <p>
                        Leangenbukta ligger på et knutepunkt for kollektivtransport, med buss- og
                        metrobussforbindelser og Leangen togstasjon i umiddelbar nærhet. Store deler
                        av Lade er bundet sammen av sykkelveier, og det er kort vei til E6.
                      </p>
                      <p>
                        Ladestien vil gå gjennom boligområdet, og herfra er det kort vei til Leangen
                        Gård, til fjæra og til kjente badeplasser. Butikker, kjøpesentre, kafeer og
                        treningssentre ligger i gangavstand, og flere av skolene i området er like
                        ved.
                      </p>
                      <p>
                        Under ser du nabolaget slik det faktisk er: hvert sted på kartet, med
                        gangavstand, sykkelavstand og kjøretid fra Leangenbukta.
                      </p>
                    </div>
                    <p className="demo-placy-cta">
                      <a
                        className="nectar-button medium regular extra-color-2 has-icon regular-button"
                        role="button"
                        href={PLACY_BOARD}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-color-override="false"
                        data-hover-color-override="false"
                        data-hover-text-color-override="#fff"
                      >
                        <span>Utforsk nabolaget med Placy</span>
                        <Arrow />
                      </a>
                    </p>
                    <p className="demo-new-tab">Åpnes i en ny fane</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div
            id="kart"
            data-column-margin="default"
            data-midnight="dark"
            className="wpb_row vc_row-fluid vc_row full-width-content has-row-bg-color vc_row-o-equal-height vc_row-flex vc_row-o-content-top"
            style={{ paddingTop: "0px", paddingBottom: "0px", "--row-bg-color": "#ffffff" } as React.CSSProperties}
          >
            <div className="row-bg-wrap" data-bg-animation="none" data-bg-overlay="false">
              <div className="inner-wrap row-bg-layer">
                <div className="row-bg viewport-desktop using-bg-color" style={{ backgroundColor: "#ffffff" }}></div>
              </div>
            </div>
            <div className="row_col_wrap_12 col span_12 dark left">
              <div
                className="vc_col-sm-12 wpb_column column_container vc_column_container col no-extra-padding inherit_tablet inherit_phone"
                data-padding-pos="all"
              >
                <div className="vc_column-inner">
                  <div className="wpb_wrapper">
                    <a
                      className="demo-location-image"
                      href={PLACY_BOARD}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Utforsk nabolaget med Placy – åpnes i en ny fane"
                    >
                      <Image
                        src={`${BASE}/Kart-over-leangenbukta-1-b06a38.png`}
                        alt="Illustrert kart over Leangenbukta og nabolaget rundt"
                        width={1754}
                        height={1240}
                        priority
                      />
                      <span className="demo-image-caption">
                        Bli kjent med nabolaget <Arrow />
                      </span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
