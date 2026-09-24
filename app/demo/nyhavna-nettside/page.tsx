import type { Metadata } from "next";
import Image from "next/image";
import Arrow from "@/app/demo/nyhavna-nettside/arrow";
import { Animation, HarbourVideo } from "@/app/demo/nyhavna-nettside/media";
export const metadata: Metadata = {
  title: "Nyhavna – Nå flytter byen nærmere fjorden",
  robots: { index: false, follow: false },
};
export default function Page() {
  return (
    <main className="root__page" id="main-content" data-placy-page-id="forside">
      <section className="page__hero">
        <div className="hero hero--mask site-width">
          <div className="hero__content-media site-width-extended use-mask">
            <Animation />
          </div>
          <div className="hero__content-text site-width">
            <div className="hero__heading">
              <h1>{"Nå flytter byen nærmere fjorden"}</h1>
            </div>
            <div className="hero__links">
              <nav role="navigation" aria-label="Snarveier">
                <ul className="hero__links-menu">
                  <li className="level0">
                    <a
                      href="https://nyhavna.no/leve/"
                      className="menu-item link-w-icon"
                    >
                      <span className="link-text">{"Leve"}</span>
                      <span className="link-icon">
                        <Arrow label="Pil" />
                      </span>
                    </a>
                  </li>
                  <li className="level0">
                    <a
                      href="https://nyhavna.no/bo/"
                      className="menu-item link-w-icon"
                    >
                      <span className="link-text">{"Bo"}</span>
                      <span className="link-icon">
                        <Arrow label="Pil" />
                      </span>
                    </a>
                  </li>
                  <li className="level0">
                    <a
                      href="/demo/nyhavna-nettside/beliggenhet"
                      className="menu-item link-w-icon"
                    >
                      <span className="link-text">{"Beliggenhet"}</span>
                      <span className="link-icon">
                        <Arrow label="Pil" />
                      </span>
                    </a>
                  </li>
                  <li className="level0">
                    <a
                      href="https://nyhavna.no/jobbe/"
                      className="menu-item link-w-icon"
                    >
                      <span className="link-text">{"Jobbe"}</span>
                      <span className="link-icon">
                        <Arrow label="Pil" />
                      </span>
                    </a>
                  </li>
                  <li className="level0">
                    <a
                      href="https://nyhavna.no/hva-skjer/"
                      className="menu-item link-w-icon"
                    >
                      <span className="link-text">{"Hva skjer"}</span>
                      <span className="link-icon">
                        <Arrow label="Pil" />
                      </span>
                    </a>
                  </li>
                  <li className="level0">
                    <a
                      href="https://nyhavna.no/nyhetsbrev/"
                      className="menu-item link-w-icon"
                    >
                      <span className="link-text">{"Nyhetsbrev"}</span>
                      <span className="link-icon">
                        <Arrow label="Pil" />
                      </span>
                    </a>
                  </li>
                </ul>
              </nav>
            </div>
          </div>
        </div>
      </section>
      <section className="page__content">
        <div className="two-column site-width-extended">
          <div className="two-column__left">
            <HarbourVideo />
          </div>
          <div className="two-column__right">
            <div className="highlighted-text site-width-extended">
              <div className="highlighted-text__tag">{" Om Nyhavna "}</div>
              <div className="highlighted-text__content">
                <p>
                  {
                    "En spasertur fra Midtbyen, der Nidelva renner ut i Trondheimsfjorden, ligger Nyhavna. Nå utvikler vi Nyhavna fra industri og havnedrift til en levende sentrumsbydel – omgitt av historie og full av nye muligheter."
                  }
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="next-events site-width-extended">
          <div className="next-events__tag">
            <h2>{"Hva skjer på Nyhavna"}</h2>
          </div>
          <div className="events__container">
            <a
              href="https://nyhavna.no/events/tise-marked-i-trondheim-LvbcW"
              className="event-item link-w-icon"
            >
              <div className="event-item__text">
                <div className="event-item__time">
                  {" 16. sep. 2026 - 17:00 "}
                </div>
                <div className="event-item__title">
                  <h3>{"Tise-marked i Trondheim"}</h3>
                </div>
              </div>
              <span className="link-icon">
                <Arrow label="Pil" />
              </span>
            </a>
            <a
              href="https://nyhavna.no/events/desken-brenner-mjBIO"
              className="event-item link-w-icon"
            >
              <div className="event-item__text">
                <div className="event-item__time">
                  {" 17. sep. 2026 - 19:00 "}
                </div>
                <div className="event-item__title">
                  <h3>{"Desken Brenner "}</h3>
                </div>
              </div>
              <span className="link-icon">
                <Arrow label="Pil" />
              </span>
            </a>
            <a
              href="https://nyhavna.no/events/nazareth-support-kristoffer-sorensen-trio-GqA8E"
              className="event-item link-w-icon"
            >
              <div className="event-item__text">
                <div className="event-item__time">
                  {" 18. sep. 2026 - 21:00 "}
                </div>
                <div className="event-item__title">
                  <h3>{"Nazareth + support: Kristoffer Sørensen Trio"}</h3>
                </div>
              </div>
              <span className="link-icon">
                <Arrow label="Pil" />
              </span>
            </a>
            <a
              href="https://nyhavna.no/events/chris-klafford-the-kitchen-session-tour-dDi9d"
              className="event-item link-w-icon"
            >
              <div className="event-item__text">
                <div className="event-item__time">
                  {" 19. sep. 2026 - 19:30 "}
                </div>
                <div className="event-item__title">
                  <h3>{"Chris Kläfford The Kitchen Session tour "}</h3>
                </div>
              </div>
              <span className="link-icon">
                <Arrow label="Pil" />
              </span>
            </a>
            <a
              href="https://nyhavna.no/events/lache-8QsQJ"
              className="event-item link-w-icon"
            >
              <div className="event-item__text">
                <div className="event-item__time">
                  {" 19. sep. 2026 - 21:00 "}
                </div>
                <div className="event-item__title">
                  <h3>{"LÂCHE "}</h3>
                </div>
              </div>
              <span className="link-icon">
                <Arrow label="Pil" />
              </span>
            </a>
          </div>
          <div className="next-events__button">
            <a href="https://nyhavna.no/hva-skjer/" className="btn">
              {" Alle arrangement "}
            </a>
          </div>
        </div>
        <div className="articles contains-swiper site-width">
          <div className="articles__heading swiper__heading site-width">
            <h2>{"Aktuelt"}</h2>
          </div>
          <div className="swiper swiper-page-list">
            <div className="swiper-wrapper demo-articles-grid">
              <a
                href="https://nyhavna.no/aktuelt/trondheim-maraton-hei-fram-loeperne-paa-nyhavna/"
                className="swiper-slide news-item"
              >
                <div className="news-item__media">
                  <Image
                    src="/demo/nyhavna-nettside/news-0.webp"
                    alt="Nyhavna"
                    loading="lazy"
                    width={600}
                    height={600}
                  />
                </div>
                <div className="news-item__text">
                  <div className="news-item__date">{" 28. august 2026 "}</div>
                  <div className="news-item__title">
                    <h2>{"Trondheim Maraton: Hei fram løperne på Nyhavna!"}</h2>
                  </div>
                </div>
              </a>
              <a
                href="https://nyhavna.no/aktuelt/brygger-beau-dro-fra-usa-til-nyhavna-for-aa-dyrke-haandverket-sitt/"
                className="swiper-slide news-item"
              >
                <div className="news-item__media">
                  <Image
                    src="/demo/nyhavna-nettside/news-1.webp"
                    alt="Beau Schiner har på seg arbeidsklær og står mellom store tretønner på et lager."
                    loading="lazy"
                    width={600}
                    height={600}
                  />
                </div>
                <div className="news-item__text">
                  <div className="news-item__date">{" 27. august 2026 "}</div>
                  <div className="news-item__title">
                    <h2>
                      {
                        "Brygger Beau dro fra USA til Nyhavna for å dyrke håndverket sitt"
                      }
                    </h2>
                  </div>
                </div>
              </a>
              <a
                href="https://nyhavna.no/aktuelt/ny-fotoutstilling-aapner-29-august/"
                className="swiper-slide news-item"
              >
                <div className="news-item__media">
                  <Image
                    src="/demo/nyhavna-nettside/news-2.webp"
                    alt="Den vakre teglsteinsbygningen er i relativt god stand. Arkitektonisk skal det opprinnelige uttrykket tilbakeføres. Illustrasjon: Nyhavna Utvikling."
                    loading="lazy"
                    width={600}
                    height={600}
                  />
                </div>
                <div className="news-item__text">
                  <div className="news-item__date">{" 27. august 2026 "}</div>
                  <div className="news-item__title">
                    <h2>{"Ny fotoutstilling åpner 29. august"}</h2>
                  </div>
                </div>
              </a>
              <a
                href="https://nyhavna.no/aktuelt/fremtidens-sjoefart-inntar-nyhavna/"
                className="swiper-slide news-item"
              >
                <div className="news-item__media">
                  <Image
                    src="/demo/nyhavna-nettside/news-3.webp"
                    alt="Nyhavna"
                    loading="lazy"
                    width={600}
                    height={600}
                  />
                </div>
                <div className="news-item__text">
                  <div className="news-item__date">{" 12. august 2026 "}</div>
                  <div className="news-item__title">
                    <h2>{"Fremtidens sjøfart inntar Nyhavna!"}</h2>
                  </div>
                </div>
              </a>
            </div>
            <div className="swiper-pagination"></div>
          </div>
        </div>
      </section>
    </main>
  );
}
