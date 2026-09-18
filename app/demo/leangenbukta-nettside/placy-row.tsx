import Arrow from "@/app/demo/leangenbukta-nettside/arrow";

export const PLACY_BOARD = "/eiendom/placy-demo/leangenbukta/rapport-board";

/**
 * Placy-inngangen på forsiden.
 *
 * Den ligger der leangenbukta.no i dag har et Leaflet-kart med ett punkt og
 * åpne OpenStreetMap-fliser — altså i seksjonen kunden allerede har bygd for
 * nabolaget, rett under deres eget illustrerte kart. Raden bruker kundens egne
 * klasser (`wpb_row`, `nectar-button`), så den ser ut som resten av siden.
 */
export function PlacyRow() {
  return (
    <div
      id="kart-placy"
      data-column-margin="default"
      data-midnight="dark"
      className="wpb_row vc_row-fluid vc_row full-width-content has-row-bg-color vc_row-o-equal-height vc_row-flex vc_row-o-content-top"
      style={{ paddingTop: "10px", paddingBottom: "10px", "--row-bg-color": "#ffffff" } as React.CSSProperties}
    >
      <div className="row-bg-wrap" data-bg-animation="none" data-bg-overlay="false">
        <div className="inner-wrap row-bg-layer">
          <div className="row-bg viewport-desktop using-bg-color" style={{ backgroundColor: "#ffffff" }}></div>
        </div>
      </div>
      <div className="row_col_wrap_12 col span_12 dark left">
        <div
          style={{ color: "#2a2c2e" }}
          className="vc_col-sm-12 wpb_column column_container vc_column_container col padding-6-percent inherit_tablet inherit_phone"
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
            <div className="wpb_wrapper demo-placy-block">
              <div className="wpb_text_column wpb_content_element">
                <h3 style={{ textAlign: "center" }}>
                  <strong>
                    <span style={{ color: "#2a2c2e" }}>Utforsk nabolaget</span>
                  </strong>
                </h3>
              </div>
              <div className="wpb_text_column wpb_content_element">
                <p style={{ textAlign: "center" }}>
                  Kartet over viser hva som ligger rundt Leangenbukta. Her kan du gå inn i
                  det: se skolene, butikkene, Ladestien og kollektivknutepunktet — og hvor
                  lang tid du bruker dit til fots, på sykkel eller med bil.
                </p>
              </div>
              <p className="demo-placy-cta" style={{ textAlign: "center" }}>
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
                  <span>Utforsk nabolaget</span>
                  <Arrow />
                </a>
              </p>
              <p className="demo-new-tab" style={{ textAlign: "center" }}>
                Åpnes i en ny fane
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
