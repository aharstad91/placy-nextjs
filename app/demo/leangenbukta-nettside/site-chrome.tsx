"use client";

/**
 * Skallet rundt Leangenbukta-replikaen: headeren, off-canvas-menyen på mobil,
 * bunnfeltet og «til toppen»-knappen. Markupen er originalens, hentet fra
 * leangenbukta.no 16.09.2026; klasse- og data-attributtene er beholdt slik at
 * temaets egen CSS (`original.css`) treffer nøyaktig som på kundens side.
 *
 * Originalen åpner mobilmenyen med Salients jQuery-oppsett. Her gjør vi det med
 * React-state, men setter de samme klassene temaet forventer:
 * `material-ocm-open` på ytterelementet og `material-open` på panelet.
 */

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import bodyAttributes from "@/data/demo/leangenbukta-nettside/body-attributes.json";

/** Forsidens body-attributter; de øvrige sidene har sine egne i body-attributes.json. */
const HOME = {
  className: "home wp-singular page-template-default page page-id-6285 wp-theme-salient material wpb-js-composer js-comp-ver-8.6.1 vc_responsive",
  bgHeader: "true",
};

export function SiteChrome({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  // Temaets CSS skiller sidemalene på body-klassene (innlegg, sider, arkiv).
  // Wrapperen er kopiens <body>, så den bærer klassene til siden som vises.
  const pathname = usePathname();
  const body = (bodyAttributes as Record<string, { className: string; bgHeader: string }>)[pathname.replace(/\/$/, "")] ?? HOME;
  const toggleMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    setMenuOpen((open) => !open);
  };
  const closeMenu = () => setMenuOpen(false);
  // Menylenkene navigerer nå i kopien uten ny sidelasting; menyen lukkes når
  // en lenke i den velges, som på originalen.
  const closeOnLink = (event: React.MouseEvent) => {
    if ((event.target as HTMLElement).closest("a[href]:not([href^='#'])")) setMenuOpen(false);
  };

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <div
      className={`leangenbukta-site ${body.className}${menuOpen ? " material-ocm-open" : ""}`}
      data-footer-reveal="1"
      data-footer-reveal-shadow="none"
      data-header-format="default"
      data-body-border="off"
      data-boxed-style=""
      data-header-breakpoint="1150"
      data-dropdown-style="minimal"
      data-cae="easeOutQuart"
      data-cad="700"
      data-megamenu-width="contained"
      data-aie="zoom-out"
      data-ls="magnific"
      data-apte="standard"
      data-hhun="0"
      data-fancy-form-rcs="default"
      data-form-style="minimal"
      data-form-submit="regular"
      data-is="minimal"
      data-button-style="default"
      data-user-account-button="false"
      data-flex-cols="true"
      data-col-gap="default"
      data-header-inherit-rc="false"
      data-header-search="false"
      data-animated-anchors="true"
      data-ajax-transitions="false"
      data-full-width-header="true"
      data-slide-out-widget-area="true"
      data-slide-out-widget-area-style="slide-out-from-right"
      data-user-set-ocm="off"
      data-loading-animation="none"
      data-bg-header={body.bgHeader}
      data-responsive="1"
      data-ext-responsive="true"
      data-ext-padding="90"
      data-header-resize="1"
      data-header-color="custom"
      data-transparent-header="false"
      data-cart="false"
      data-m-animate="0"
      data-force-header-trans-color="light"
      data-smooth-scrolling="0"
      data-permanent-transparent="false"
    >
      <div className={menuOpen ? "ocm-effect-wrap material-ocm-open" : "ocm-effect-wrap"}>
        <div className="ocm-effect-wrap-inner">
          <div id="header-space" data-header-mobile-fixed="1"></div>
          <div id="header-outer" className={menuOpen ? "side-widget-open" : undefined} data-has-menu="true" data-has-buttons="no" data-header-button_style="default" data-using-pr-menu="false" data-mobile-fixed="1" data-ptnm="false" data-lhe="animated_underline" data-user-set-bg="#ffffff" data-format="default" data-permanent-transparent="false" data-megamenu-rt="0" data-remove-fixed="0" data-header-resize="1" data-cart="false" data-transparency-option="1" data-box-shadow="none" data-shrink-num="20" data-using-secondary="0" data-using-logo="1" data-logo-height="78" data-m-logo-height="68" data-padding="20" data-full-width="true" data-condense="false">
          <div id="search-outer" className="nectar">
          <div id="search">
          <div className="container">
          <div id="search-box">
          <div className="inner-wrap">
          <div className="col span_12">
          <form role="search" action="https://leangenbukta.no/" method="GET">
          <input type="text" name="s" defaultValue="" aria-label="Search" placeholder="Search" />
          <span>Hit enter to search or ESC to close</span>
          <button aria-label="Search" className="search-box__button" type="submit">Search</button> </form>
          </div>
          </div>
          </div>
          <div id="close"><a href="#" role="button"><span className="screen-reader-text">Close Search</span>
          <span className="close-wrap"> <span className="close-line close-line1" role="presentation"></span> <span className="close-line close-line2" role="presentation"></span> </span> </a></div>
          </div>
          </div>
          </div>
          <header id="top" role="banner" aria-label="Main Menu">
          <div className="container">
          <div className="row">
          <div className="col span_3">
          <Link id="logo" href="/demo/leangenbukta-nettside" data-no-transition data-supplied-ml-starting-dark="false" data-supplied-ml-starting="false" data-supplied-ml="false">
          <Image className="stnd skip-lazy default-logo" alt="Leangenbukta" src="/demo/leangenbukta-nettside/Leangenbukta_brown_02-3a68c2.svg" width={600} height={170} unoptimized /> </Link>
          </div>
          <div className="col span_9 col_last">
          <div className="nectar-mobile-only mobile-header"><div className="inner"></div></div>
          <div className="slide-out-widget-area-toggle mobile-icon slide-out-from-right" data-custom-color="false" data-icon-animation="simple-transform">
          <div> <a href="#slide-out-widget-area" role="button" aria-label="Navigation Menu" aria-expanded={menuOpen} className={menuOpen ? "open" : "closed"} onClick={toggleMenu}>
          <span className="screen-reader-text">Menu</span><span aria-hidden="true"> <i className="lines-button x2"> <i className="lines"></i> </i> </span> </a></div>
          </div>
          <nav aria-label="Main Menu">
          <ul className="sf-menu">
          <li id="menu-item-7942" className="menu-item menu-item-type-custom menu-item-object-custom button_bordered menu-item-7942"><a href="#kontakt"><span className="menu-title-text">Meld interesse</span></a></li>
          <li id="menu-item-9731" className="menu-item menu-item-type-post_type menu-item-object-page nectar-regular-menu-item menu-item-9731"><Link href="/demo/leangenbukta-nettside/salgsmateriell"><span className="menu-title-text">Prospekter</span></Link></li>
          <li id="menu-item-17475" className="menu-item menu-item-type-custom menu-item-object-custom nectar-regular-menu-item menu-item-17475"><a href="https://leangenbukta.plyo.cloud/" data-demo-external="true" target="_blank" rel="noopener noreferrer"><span className="menu-title-text">Boligvelger</span></a></li>
          <li className="menu-item menu-item-type-post_type menu-item-object-page nectar-regular-menu-item menu-item-beliggenhet"><Link href="/demo/leangenbukta-nettside/beliggenhet" data-no-transition onClick={closeMenu}><span className="menu-title-text">Beliggenhet</span></Link></li>
          <li id="menu-item-8516" className="menu-item menu-item-type-post_type menu-item-object-page current-menu-ancestor current-menu-parent current_page_parent current_page_ancestor menu-item-has-children nectar-regular-menu-item sf-with-ul menu-item-8516"><Link href="/demo/leangenbukta-nettside/om-prosjektet" aria-haspopup="true" aria-expanded="false"><span className="menu-title-text">Om prosjektet</span><span className="sf-sub-indicator"><i className="fa fa-angle-down icon-in-menu" aria-hidden="true"></i></span></Link>
          <ul className="sub-menu">
          <li id="menu-item-11125" className="menu-item menu-item-type-custom menu-item-object-custom current-menu-item current_page_item menu-item-home nectar-regular-menu-item menu-item-11125"><Link href="/demo/leangenbukta-nettside#kart" aria-current="page"><span className="menu-title-text">Kart</span></Link></li>
          <li id="menu-item-8339" className="menu-item menu-item-type-post_type menu-item-object-page nectar-regular-menu-item menu-item-8339"><Link href="/demo/leangenbukta-nettside/bli-obos-medlem"><span className="menu-title-text">Bli OBOS-medlem</span></Link></li>
          <li id="menu-item-10760" className="menu-item menu-item-type-post_type menu-item-object-page nectar-regular-menu-item menu-item-10760"><Link href="/demo/leangenbukta-nettside/galleri"><span className="menu-title-text">Galleri</span></Link></li>
          <li id="menu-item-14948" className="menu-item menu-item-type-post_type menu-item-object-page menu-item-has-children nectar-regular-menu-item menu-item-14948"><Link href="/demo/leangenbukta-nettside/apenhetsloven" aria-haspopup="true" aria-expanded="false"><span className="menu-title-text">Åpenhetsloven</span><span className="sf-sub-indicator"><i className="fa fa-angle-right icon-in-menu" aria-hidden="true"></i></span></Link>
          <ul className="sub-menu">
          <li id="menu-item-17346" className="menu-item menu-item-type-custom menu-item-object-custom nectar-regular-menu-item menu-item-17346"><a href="https://koteng.no/om-koteng/varsling-av-kritikkverdige-forhold/" data-demo-external="true" target="_blank" rel="noopener noreferrer"><span className="menu-title-text">Varsling av kritikkverdige forhold</span></a></li>
          </ul>
          </li>
          </ul>
          </li>
          <li id="menu-item-8678" className="menu-item menu-item-type-post_type menu-item-object-page nectar-regular-menu-item menu-item-8678"><Link href="/demo/leangenbukta-nettside/aktuelt"><span className="menu-title-text">Aktuelt</span></Link></li>
          <li id="menu-item-13883" className="menu-item menu-item-type-post_type menu-item-object-page menu-item-has-children nectar-regular-menu-item sf-with-ul menu-item-13883"><Link href="/demo/leangenbukta-nettside/kundeportal" aria-haspopup="true" aria-expanded="false"><span className="menu-title-text">Kundeportal</span><span className="sf-sub-indicator"><i className="fa fa-angle-down icon-in-menu" aria-hidden="true"></i></span></Link>
          <ul className="sub-menu">
          <li id="menu-item-13885" className="menu-item menu-item-type-custom menu-item-object-custom nectar-regular-menu-item menu-item-13885"><a href="https://app.locka.cloud/haakon-vii-gt-14-as/" data-demo-external="true" target="_blank" rel="noopener noreferrer"><span className="menu-title-text">Byggetrinn 1</span></a></li>
          <li id="menu-item-13884" className="menu-item menu-item-type-custom menu-item-object-custom nectar-regular-menu-item menu-item-13884"><a href="https://haakonviigt14.locka.cloud" data-demo-external="true" target="_blank" rel="noopener noreferrer"><span className="menu-title-text">Byggetrinn 2</span></a></li>
          <li id="menu-item-16662" className="menu-item menu-item-type-custom menu-item-object-custom nectar-regular-menu-item menu-item-16662"><a href="https://client.journeyapp.tech/auth/sign-in" data-demo-external="true" target="_blank" rel="noopener noreferrer"><span className="menu-title-text">Saltakshus H og Rekkehus 19-27</span></a></li>
          <li id="menu-item-18155" className="menu-item menu-item-type-custom menu-item-object-custom nectar-regular-menu-item menu-item-18155"><a href="https://client.journeyapp.tech/auth/sign-in" data-demo-external="true" target="_blank" rel="noopener noreferrer"><span className="menu-title-text">Knutepunktet</span></a></li>
          </ul>
          </li>
          </ul>
          <ul className="buttons sf-menu" data-user-set-ocm="off"></ul>
          </nav>
          </div>
          </div>
          </div>
          </header>
          </div>
          <div id="ajax-content-wrap">
            {children}
            <div id="footer-outer" data-cols="1" data-custom-color="true" data-disable-copyright="false" data-matching-section-color="true" data-copyright-line="false" data-using-bg-img="false" data-bg-img-overlay="0.8" data-full-width="false" data-using-widget-area="false" data-link-hover="default" role="contentinfo">
            <div className="row" id="copyright" data-layout="default">
            <div className="container">
            <div className="col span_7 col_last">
            <ul className="social">
            </ul>
            </div>
            <div className="col span_5">
            <div id="block-3" className="widget widget_block widget_text">
            <p><a href="https://koteng.no/om-koteng/varsling-av-kritikkverdige-forhold/" data-demo-external="true" target="_blank" rel="noopener noreferrer" data-type="link" data-id="https://koteng.no/om-koteng/varsling-av-kritikkverdige-forhold/">Varsling av kritikkverdige forhold</a></p>
            </div><p>Et <a href="https://kotengjenssen.no" data-demo-external="true" target="_blank" rel="noopener noreferrer">Koteng Jenssen</a> og <a href="https://obos.no" data-demo-external="true" target="_blank" rel="noopener noreferrer">OBOS</a> prosjekt.  Se <Link href="/demo/leangenbukta-nettside/personvern">personvernpolicy</Link></p> </div>
            </div>
            </div>
            </div>
          </div>
          <a id="to-top" aria-label="Til toppen" role="button" href="#" className="mobile-enabled">
            <i role="presentation" className="fa fa-angle-up"></i>
          </a>
        </div>
      </div>
      <div id="slide-out-widget-area-bg" className="slide-out-from-right dark" onClick={closeMenu}>
      </div>
      <div id="slide-out-widget-area" role="dialog" aria-modal="true" onClickCapture={closeOnLink} className={menuOpen ? "slide-out-from-right material-open" : "slide-out-from-right"} aria-label="Off Canvas Menu" data-dropdown-func="separate-dropdown-parent-link" data-back-txt="Back">
      <div className="inner-wrap">
      <div className="inner" data-prepend-menu-mobile="false">
      <a className="demo-menu-close" href="#" onClick={closeMenu}><span className="screen-reader-text">Lukk menyen</span><span aria-hidden="true">×</span></a>
      <div className="off-canvas-menu-container mobile-only" role="navigation">
      <ul className="menu">
      <li className="menu-item menu-item-type-custom menu-item-object-custom menu-item-7942"><a href="#kontakt">Meld interesse</a></li>
      <li className="menu-item menu-item-type-post_type menu-item-object-page menu-item-9731"><Link href="/demo/leangenbukta-nettside/salgsmateriell">Prospekter</Link></li>
      <li className="menu-item menu-item-type-custom menu-item-object-custom menu-item-17475"><a href="https://leangenbukta.plyo.cloud/" data-demo-external="true" target="_blank" rel="noopener noreferrer">Boligvelger</a></li>
      <li className="menu-item menu-item-type-post_type menu-item-object-page menu-item-beliggenhet"><Link href="/demo/leangenbukta-nettside/beliggenhet" data-no-transition onClick={closeMenu}>Beliggenhet</Link></li>
      <li className="menu-item menu-item-type-post_type menu-item-object-page current-menu-ancestor current-menu-parent current_page_parent current_page_ancestor menu-item-has-children menu-item-8516"><Link href="/demo/leangenbukta-nettside/om-prosjektet" aria-haspopup="true" aria-expanded="false">Om prosjektet</Link>
      <ul className="sub-menu">
      <li className="menu-item menu-item-type-custom menu-item-object-custom current-menu-item current_page_item menu-item-home menu-item-11125"><Link href="/demo/leangenbukta-nettside#kart" aria-current="page">Kart</Link></li>
      <li className="menu-item menu-item-type-post_type menu-item-object-page menu-item-8339"><Link href="/demo/leangenbukta-nettside/bli-obos-medlem">Bli OBOS-medlem</Link></li>
      <li className="menu-item menu-item-type-post_type menu-item-object-page menu-item-10760"><Link href="/demo/leangenbukta-nettside/galleri">Galleri</Link></li>
      <li className="menu-item menu-item-type-post_type menu-item-object-page menu-item-has-children menu-item-14948"><Link href="/demo/leangenbukta-nettside/apenhetsloven" aria-haspopup="true" aria-expanded="false">Åpenhetsloven</Link>
      <ul className="sub-menu">
      <li className="menu-item menu-item-type-custom menu-item-object-custom menu-item-17346"><a href="https://koteng.no/om-koteng/varsling-av-kritikkverdige-forhold/" data-demo-external="true" target="_blank" rel="noopener noreferrer">Varsling av kritikkverdige forhold</a></li>
      </ul>
      </li>
      </ul>
      </li>
      <li className="menu-item menu-item-type-post_type menu-item-object-page menu-item-8678"><Link href="/demo/leangenbukta-nettside/aktuelt">Aktuelt</Link></li>
      <li className="menu-item menu-item-type-post_type menu-item-object-page menu-item-has-children menu-item-13883"><Link href="/demo/leangenbukta-nettside/kundeportal" aria-haspopup="true" aria-expanded="false">Kundeportal</Link>
      <ul className="sub-menu">
      <li className="menu-item menu-item-type-custom menu-item-object-custom menu-item-13885"><a href="https://app.locka.cloud/haakon-vii-gt-14-as/" data-demo-external="true" target="_blank" rel="noopener noreferrer">Byggetrinn 1</a></li>
      <li className="menu-item menu-item-type-custom menu-item-object-custom menu-item-13884"><a href="https://haakonviigt14.locka.cloud" data-demo-external="true" target="_blank" rel="noopener noreferrer">Byggetrinn 2</a></li>
      <li className="menu-item menu-item-type-custom menu-item-object-custom menu-item-16662"><a href="https://client.journeyapp.tech/auth/sign-in" data-demo-external="true" target="_blank" rel="noopener noreferrer">Saltakshus H og Rekkehus 19-27</a></li>
      <li className="menu-item menu-item-type-custom menu-item-object-custom menu-item-18155"><a href="https://client.journeyapp.tech/auth/sign-in" data-demo-external="true" target="_blank" rel="noopener noreferrer">Knutepunktet</a></li>
      </ul>
      </li>
      </ul>
      <ul className="menu secondary-header-items">
      </ul>
      </div>
      </div>
      <div className="bottom-meta-wrap"><ul className="off-canvas-social-links"></ul></div></div> 
      </div>
    </div>
  );
}
