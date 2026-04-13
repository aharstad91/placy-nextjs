import Image from "next/image";

export default function WesselsloekaFooter() {
  return (
    <footer className="ws-footer">
      <div className="ws-footer__inner">
        <div className="ws-footer__col">
          <Image
            src="/ws-demo/wesselslokka-script.webp"
            alt="Wesselsløkka"
            width={200}
            height={48}
            className="ws-footer__wordmark"
          />
          <p className="ws-footer__tagline">
            Norges grønneste nabolag. Første byggetrinn i den nye grønne
            bydelen Brøset — i samarbeid med Heimdal Eiendomsmegling.
          </p>
        </div>

        <div className="ws-footer__col">
          <h3 className="ws-footer__heading">Åpent infosenter</h3>
          <p>Tirsdager kl. 12.00–17.00</p>
          <p>Brøsetvegen 145, 7046 Trondheim</p>
        </div>

        <div className="ws-footer__col">
          <h3 className="ws-footer__heading">Kontakt</h3>
          <p>Heimdal Eiendomsmegling AS</p>
          <p>Telefon: 72 90 02 90</p>
          <p>
            <a href="https://www.wesselslokka.no/" className="ws-footer__link">
              wesselslokka.no
            </a>
          </p>
        </div>

        <div className="ws-footer__col">
          <h3 className="ws-footer__heading">Følg oss</h3>
          <div className="ws-footer__social">
            <a href="#" aria-label="Facebook" className="ws-footer__social-link">
              Facebook
            </a>
            <a
              href="#"
              aria-label="Instagram"
              className="ws-footer__social-link"
            >
              Instagram
            </a>
          </div>
        </div>
      </div>

      <div className="ws-footer__bottom">
        <p>© Heimdal Eiendomsmegling AS · Wesselsløkka</p>
        <p className="ws-footer__credit">
          Nabolagsdata levert av{" "}
          <a href="https://placy.no" className="ws-footer__link">
            Placy
          </a>
        </p>
      </div>
    </footer>
  );
}
