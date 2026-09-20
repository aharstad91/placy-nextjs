import type { Metadata } from "next";
import Image from "next/image";
import { PlacyRow } from "@/app/demo/leangenbukta-nettside/placy-row";

export const metadata: Metadata = {
  title: "Leangenbukta",
  description:
    "Lokal kopi av leangenbukta.no, bygd for å vise hvordan Placy limes inn i kundens egen nettside.",
  robots: { index: false, follow: false },
};

/**
 * Forsiden til leangenbukta.no, gjenskapt fra et øyeblikksbilde 16.09.2026.
 *
 * Markupen er kundens egen — klassene er Salient/WPBakery sine, og `original.css`
 * er deres eget stilark med alle selektorer avgrenset til `.leangenbukta-site`.
 * To ting er våre: helten spiller filmen med et ekte <video>-element (originalen
 * lar jarallax sette den inn), og raden der deres Leaflet-kart ligger i dag er
 * byttet ut med Placy-inngangen. Det er nettopp det innlimingen handler om.
 */
export default function Page() {
  const placyBlock = <PlacyRow />;

  return (
    <>
    <div className="container-wrap">
    <div className="container main-content" role="main">
    <div className="row">
    <div id="fws_6aaab6eb0210a" data-column-margin="default" data-midnight="dark" className="wpb_row vc_row-fluid vc_row full-width-content vc_row-o-equal-height vc_row-flex vc_row-o-content-top hash mobile-image bilderad height1000" style={{ paddingTop: "0px", paddingBottom: "0px" }}><div className="row-bg-wrap" data-bg-animation="none" data-bg-animation-delay="" data-bg-overlay="false"><div className="inner-wrap row-bg-layer"><div className="row-bg viewport-desktop"></div><div className="demo-hero-video"><video autoPlay muted loop playsInline poster="/demo/leangenbukta-nettside/hero-poster.jpg"><source src="/demo/leangenbukta-nettside/hero-film.mp4" type="video/mp4" /></video></div></div></div><div className="row_col_wrap_12 col span_12 dark left">
    <div style={{ color: "#ffffff" }} className="vc_col-sm-12 vc_hidden-sm vc_hidden-xs wpb_column column_container vc_column_container col centered-text has-animation no-extra-padding inherit_tablet inherit_phone flex_gap_desktop_10px " data-cfc="true" data-padding-pos="all" data-has-bg-color="false" data-bg-color="" data-bg-opacity="1" data-animation="fade-in-from-right" data-delay="0">
    <div className="vc_column-inner">
    <div className="wpb_wrapper">
    </div>
    </div>
    </div>
    </div></div>
    <div id="8godegrunner" data-column-margin="default" data-midnight="dark" className="wpb_row vc_row-fluid vc_row full-width-content vc_row-o-equal-height vc_row-flex vc_row-o-content-top hash" style={{ paddingTop: "10px", paddingBottom: "0px" }}><div className="row-bg-wrap" data-bg-animation="none" data-bg-animation-delay="" data-bg-overlay="false"><div className="inner-wrap row-bg-layer"><div className="row-bg viewport-desktop"></div></div></div><div className="row_col_wrap_12 col span_12 dark left">
    <div style={{ color: "#2a2c2e" }} className="vc_col-sm-12 border-right wpb_column column_container vc_column_container col padding-6-percent inherit_tablet inherit_phone flex_gap_desktop_10px " data-cfc="true" data-using-bg="true" data-padding-pos="all" data-has-bg-color="true" data-bg-color="#d6c6b7" data-bg-opacity="1" data-animation="" data-delay="0">
    <div className="vc_column-inner"><div className="column-bg-overlay-wrap column-bg-layer" data-bg-animation="none"><div className="column-bg-overlay" style={{ opacity: "1", backgroundColor: "#d6c6b7" }}></div></div>
    <div className="wpb_wrapper">
    <div className="wpb_text_column wpb_content_element ">
    <h3 style={{ textAlign: "center" }}><strong><span style={{ color: "#2a2c2e" }}>Drop-in visning hver mandag kl 15-16</span></strong></h3>
    </div>
    <div className="wpb_text_column wpb_content_element ">
    <p style={{ textAlign: "center" }}><strong>Hver mandag fra kl. 15- 16</strong> <strong>i vårt salgslokale i Leangenbukta (brakkeriggen). </strong></p>
    <p style={{ textAlign: "center" }}>Her kan du få mer informasjon om prosjektet og kan bli med inn i våre visningsleiligheter. Velkommen!</p>
    </div>
    </div>
    </div>
    </div>
    </div></div>
    <div id="prosjektet" data-column-margin="default" data-midnight="dark" className="wpb_row vc_row-fluid vc_row full-width-content vc_row-o-equal-height vc_row-flex vc_row-o-content-top hash" style={{ paddingTop: "10px", paddingBottom: "0px" }}><div className="row-bg-wrap" data-bg-animation="none" data-bg-animation-delay="" data-bg-overlay="false"><div className="inner-wrap row-bg-layer"><div className="row-bg viewport-desktop"></div></div></div><div className="row_col_wrap_12 col span_12 dark left">
    <div style={{ color: "#ffffff" }} className="vc_col-sm-6 border-right wpb_column column_container vc_column_container col has-animation no-extra-padding inherit_tablet inherit_phone " data-cfc="true" data-using-bg="true" data-bg-cover="true" data-padding-pos="all" data-has-bg-color="false" data-bg-color="" data-bg-opacity="1" data-animation="fade-in-from-right" data-delay="0">
    <div className="vc_column-inner"><div className="column-image-bg-wrap column-bg-layer viewport-desktop" data-bg-pos="center center" data-bg-animation="none" data-bg-overlay="false"><div className="inner-wrap"><div className="column-image-bg" style={{ backgroundImage: "url('/demo/leangenbukta-nettside/30stue2-1773d2.jpg')" }}></div></div></div>
    <div className="wpb_wrapper">
    </div>
    </div>
    </div>
    <div className="nk-awb  nk-awb-after-vc_column "><div className="nk-awb-wrap" data-awb-type="video" data-awb-image-background-size="cover" data-awb-image-background-position="50% 50%" data-awb-video="" data-awb-video-start-time="0" data-awb-video-end-time="0" data-awb-video-volume="0" data-awb-video-always-play="true" data-awb-video-mobile="false"><div className="nk-awb-inner"></div></div></div>
    <div style={{ color: "#2a2c2e" }} className="vc_col-sm-6 border-left wpb_column column_container vc_column_container col padding-6-percent inherit_tablet inherit_phone flex_gap_desktop_10px " data-cfc="true" data-using-bg="true" data-padding-pos="all" data-has-bg-color="true" data-bg-color="#d6c6b7" data-bg-opacity="1" data-animation="" data-delay="0">
    <div className="vc_column-inner"><div className="column-bg-overlay-wrap column-bg-layer" data-bg-animation="none"><div className="column-bg-overlay" style={{ opacity: "1", backgroundColor: "#d6c6b7" }}></div></div>
    <div className="wpb_wrapper">
    <div className="wpb_text_column wpb_content_element ">
    </div>
    <div className="wpb_text_column wpb_content_element ">
    <h3><strong>Flytte inn nå, eller i løpet av året?</strong></h3>
    </div>
    <div className="divider-wrap" data-alignment="default"><div style={{ height: "15px" }} className="divider"></div></div>
    <div className="wpb_text_column wpb_content_element ">
    <div className="" data-block="true" data-editor="2lbqn" data-offset-key="elqq2-0-0">
    <p><strong>Leiligheter fra 27,5- 88 m<span className="ILfuVd"><span className="hgKElc">²</span></span></strong></p>
    </div>
    </div>
    <div className="wpb_text_column wpb_content_element ">
    <div className="" data-block="true" data-editor="2lbqn" data-offset-key="elqq2-0-0">
    <p>Vi har innflyttingsklare leiligheter og leiligheter som er klare for overtakelse i siste kvartal av 2026. Ta en titt og se hva du kan velge i!</p>
    </div>
    </div>
    <div className="wpb_text_column wpb_content_element ">
    </div>
    <a className="nectar-button medium regular extra-color-2 has-icon  regular-button" role="button" href="https://leangenbukta.no/innflyttingsklare-leiligheter/" data-color-override="false" data-hover-color-override="false" data-hover-text-color-override="#fff"><span>Se utvalget</span><i><span className="im-icon-wrap"><span><svg role="presentation" version="1.1" xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <path d="M28.328 20c-0.145 0-0.295-0.048-0.417-0.145-0.288-0.229-0.333-0.648-0.103-0.937l2.331-2.917-2.331-2.916c-0.231-0.287-0.185-0.708 0.103-0.937 0.291-0.231 0.708-0.184 0.937 0.104l2.665 3.333c0.195 0.244 0.195 0.589 0 0.833l-2.665 3.333c-0.131 0.164-0.324 0.249-0.52 0.249zM30.341 16.667h-29.333c-0.367 0-0.667-0.299-0.667-0.667s0.3-0.667 0.667-0.667h29.333c0.367 0 0.667 0.299 0.667 0.667s-0.3 0.667-0.667 0.667z"></path>
    </svg></span></span></i></a><div className="divider-wrap" data-alignment="default"><div style={{ height: "15px" }} className="divider"></div></div>
    <div className="wpb_text_column wpb_content_element ">
    </div>
    <div className="wpb_text_column wpb_content_element ">
    </div>
    </div>
    </div>
    </div>
    </div></div>
    <div id="8godegrunner" data-column-margin="default" data-midnight="dark" className="wpb_row vc_row-fluid vc_row full-width-content vc_row-o-equal-height vc_row-flex vc_row-o-content-top hash" style={{ paddingTop: "10px", paddingBottom: "0px" }}><div className="row-bg-wrap" data-bg-animation="none" data-bg-animation-delay="" data-bg-overlay="false"><div className="inner-wrap row-bg-layer"><div className="row-bg viewport-desktop"></div></div></div><div className="row_col_wrap_12 col span_12 dark left">
    <div style={{ color: "#2a2c2e" }} className="vc_col-sm-12 vc_hidden-lg vc_hidden-md border-right wpb_column column_container vc_column_container col padding-6-percent inherit_tablet inherit_phone flex_gap_desktop_10px " data-cfc="true" data-using-bg="true" data-padding-pos="all" data-has-bg-color="true" data-bg-color="#d6c6b7" data-bg-opacity="1" data-animation="" data-delay="0">
    <div className="vc_column-inner"><div className="column-bg-overlay-wrap column-bg-layer" data-bg-animation="none"><div className="column-bg-overlay" style={{ opacity: "1", backgroundColor: "#d6c6b7" }}></div></div>
    <div className="wpb_wrapper">
    <div className="img-with-aniamtion-wrap center" data-max-width="100%" data-max-width-mobile="default" data-shadow="none" data-animation="none">
    <div className="inner">
    <div className="hover-wrap">
    <div className="hover-wrap-inner">
    <Image fetchPriority="high" className="img-with-animation skip-lazy" data-animation="none" src="/demo/leangenbukta-nettside/Leangenbukta_Eksterior_Drone-004_v3_3destate.no_-f22318.jpg" alt="" width={1800} height={1199} />
    </div>
    </div>
    </div>
    </div>
    </div>
    </div>
    </div>
    </div></div>
    <div id="8godegrunner" data-column-margin="default" data-midnight="dark" className="wpb_row vc_row-fluid vc_row full-width-content vc_row-o-equal-height vc_row-flex vc_row-o-content-top hash" style={{ paddingTop: "10px", paddingBottom: "0px" }}><div className="row-bg-wrap" data-bg-animation="none" data-bg-animation-delay="" data-bg-overlay="false"><div className="inner-wrap row-bg-layer"><div className="row-bg viewport-desktop"></div></div></div><div className="row_col_wrap_12 col span_12 dark left">
    <div style={{ color: "#2a2c2e" }} className="vc_col-sm-6 border-right wpb_column column_container vc_column_container col padding-6-percent inherit_tablet inherit_phone flex_gap_desktop_10px " data-cfc="true" data-using-bg="true" data-padding-pos="all" data-has-bg-color="true" data-bg-color="#d6c6b7" data-bg-opacity="1" data-animation="" data-delay="0">
    <div className="vc_column-inner"><div className="column-bg-overlay-wrap column-bg-layer" data-bg-animation="none"><div className="column-bg-overlay" style={{ opacity: "1", backgroundColor: "#d6c6b7" }}></div></div>
    <div className="wpb_wrapper">
    <div className="wpb_text_column wpb_content_element ">
    <h3><strong><span style={{ color: "#2a2c2e" }}>8 grunner til at Leangenbukta er stedet å bo!</span></strong></h3>
    </div>
    <div className="wpb_text_column wpb_content_element ">
    <h5 style={{ textAlign: "left" }}><strong>Trygt og bilfritt bomiljø</strong></h5>
    <p style={{ textAlign: "left" }}>Bebyggelsen skjermer for vei og trafikk og åpner seg mot kulturlandskapet. Parkering i parkeringskjeller med et bilfritt utomhusareal mellom boligene. <a href="https://leangenbukta.no/om-prosjektet/#beliggenhet">Les mer</a></p>
    </div>
    <div className="wpb_text_column wpb_content_element ">
    <h5 style={{ textAlign: "left" }}><strong>Gangavstand til alt du trenger</strong></h5>
    <p style={{ textAlign: "left" }}>Butikker, kjøpesentre, spesialforretninger, kafè- og spiseplasser og treningssentre i umiddelbar nærhet. <a href="https://leangenbukta.no/om-prosjektet/#beliggenhet">Les mer</a></p>
    </div>
    <div className="wpb_text_column wpb_content_element ">
    <h5 style={{ textAlign: "left" }}><strong>Bærekraftige løsninger</strong></h5>
    <p style={{ textAlign: "left" }}>Vi fører «Grønn Strategi» gjennom hele prosjektet! Ved bruk av varige materialer, stedsriktig beplanting og bevaring av trær. <a href="https://leangenbukta.no/om-prosjektet/#gronn-strategi">Les mer</a></p>
    </div>
    <div className="wpb_text_column wpb_content_element ">
    <h5 style={{ textAlign: "left" }}><strong>Knutepunkt for kollektivtransport</strong></h5>
    <p style={{ textAlign: "left" }}>I umiddelbar nærhet ligger buss/metrobuss-forbindelser, Leangen togstasjon, sykkelveier og kort avstand til E6. <a href="https://leangenbukta.no/om-prosjektet/#beliggenhet">Les mer</a></p>
    </div>
    <a className="nectar-button medium regular extra-color-2 has-icon  regular-button displaynone" role="button" href="#kontakt" data-color-override="false" data-hover-color-override="false" data-hover-text-color-override="#fff"><span>Meld din interesse</span><i><span className="im-icon-wrap"><span><svg role="presentation" version="1.1" xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <path d="M28.328 20c-0.145 0-0.295-0.048-0.417-0.145-0.288-0.229-0.333-0.648-0.103-0.937l2.331-2.917-2.331-2.916c-0.231-0.287-0.185-0.708 0.103-0.937 0.291-0.231 0.708-0.184 0.937 0.104l2.665 3.333c0.195 0.244 0.195 0.589 0 0.833l-2.665 3.333c-0.131 0.164-0.324 0.249-0.52 0.249zM30.341 16.667h-29.333c-0.367 0-0.667-0.299-0.667-0.667s0.3-0.667 0.667-0.667h29.333c0.367 0 0.667 0.299 0.667 0.667s-0.3 0.667-0.667 0.667z"></path>
    </svg></span></span></i></a>
    </div>
    </div>
    </div>
    <div style={{ color: "#ffffff" }} className="vc_col-sm-6 vc_hidden-sm vc_hidden-xs border-left wpb_column column_container vc_column_container col has-animation no-extra-padding inherit_tablet inherit_phone " data-cfc="true" data-using-bg="true" data-bg-cover="true" data-padding-pos="all" data-has-bg-color="false" data-bg-color="" data-bg-opacity="1" data-animation="fade-in-from-right" data-delay="0">
    <div className="vc_column-inner"><div className="column-image-bg-wrap column-bg-layer viewport-desktop" data-bg-pos="center center" data-bg-animation="none" data-bg-overlay="false"><div className="inner-wrap"><div className="column-image-bg" style={{ backgroundImage: "url('/demo/leangenbukta-nettside/DSC1773-copy-23d7a3.jpg')" }}></div></div></div>
    <div className="wpb_wrapper">
    </div>
    </div>
    </div>
    </div></div>
    <div id="fws_6aaab6eb04fce" data-column-margin="default" data-midnight="dark" className="wpb_row vc_row-fluid vc_row full-width-content vc_row-o-equal-height vc_row-flex hash" style={{ paddingTop: "10px", paddingBottom: "0px" }}><div className="row-bg-wrap" data-bg-animation="none" data-bg-animation-delay="" data-bg-overlay="false"><div className="inner-wrap row-bg-layer"><div className="row-bg viewport-desktop"></div></div></div><div className="row_col_wrap_12 col span_12 dark left">
    <div style={{ color: "#ffffff" }} className="vc_col-sm-6 vc_hidden-sm vc_hidden-xs border-right wpb_column column_container vc_column_container col no-extra-padding inherit_tablet inherit_phone " data-cfc="true" data-using-bg="true" data-bg-cover="true" data-padding-pos="all" data-has-bg-color="false" data-bg-color="" data-bg-opacity="1" data-animation="" data-delay="0">
    <div className="vc_column-inner"><div className="column-image-bg-wrap column-bg-layer viewport-desktop" data-bg-pos="center center" data-bg-animation="none" data-bg-overlay="false"><div className="inner-wrap"><div className="column-image-bg" style={{ backgroundImage: "url('/demo/leangenbukta-nettside/DSC0562-copy-42ddbf.jpg')" }}></div></div></div>
    <div className="wpb_wrapper">
    </div>
    </div>
    </div>
    <div style={{ color: "#2a2c2e" }} className="vc_col-sm-6 border-left wpb_column column_container vc_column_container col has-animation padding-6-percent inherit_tablet inherit_phone flex_gap_desktop_10px " data-cfc="true" data-using-bg="true" data-padding-pos="all" data-has-bg-color="true" data-bg-color="#d6c6b7" data-bg-opacity="1" data-animation="fade-in-from-right" data-delay="0">
    <div className="vc_column-inner"><div className="column-bg-overlay-wrap column-bg-layer" data-bg-animation="none"><div className="column-bg-overlay" style={{ opacity: "1", backgroundColor: "#d6c6b7" }}></div></div>
    <div className="wpb_wrapper">
    <div className="wpb_text_column wpb_content_element ">
    <h5 style={{ textAlign: "left" }}><strong>En del av Ladestien, fjæra og kulturlandskapet</strong></h5>
    <p style={{ textAlign: "left" }}>Bo midt i et av de vakreste turområdene i Trondheim. Ladestien vil gå gjennom boligområdet, og her er det også kort vei til Leangen Gård og kjente badeplasser. <a href="https://leangenbukta.no/om-prosjektet/#beliggenhet">Les mer</a></p>
    </div>
    <div className="wpb_text_column wpb_content_element ">
    <h5 style={{ textAlign: "left" }}><strong>El-bildeling</strong></h5>
    <p style={{ textAlign: "left" }}>Vi tilrettelegger for et antall biler som kan benyttes av beboere ved behov. Med bildelingstjenesten betaler du bare når du bruker bilen. <a href="https://leangenbukta.no/om-prosjektet/#ekstra-fasiliteter">Les mer</a></p>
    </div>
    <div className="wpb_text_column wpb_content_element ">
    <h5 style={{ textAlign: "left" }}><strong>Et sosialt nabolag</strong></h5>
    <p style={{ textAlign: "left" }}>Vi skal etablere en felles «lounge» som kan fungere som kafè, møtested, arbeidssted osv. Her kan man nå ytterligere fasiliteter som lekerom, treningsrom, utlånsleilighet og forsamlingslokale. <a href="https://leangenbukta.no/om-prosjektet/#ambisjoner">Les mer</a></p>
    </div>
    <div className="wpb_text_column wpb_content_element ">
    <h5 style={{ textAlign: "left" }}><strong>Moderne og tidløs arkitektur</strong></h5>
    <p style={{ textAlign: "left" }}>Vi vektlegger store vindusflater, gjennomlys, planløsning og fasadematerialer som krever lite vedlikehold. Bruk av tegl og tre i kombinasjon vil være en rød trå gjennom prosjektet, noe som gir et bestandig uttrykk. <a href="https://leangenbukta.no/om-prosjektet/#kvalitet-arkitektur">Les mer</a></p>
    </div>
    <div className="divider-wrap" data-alignment="default"><div style={{ height: "15px" }} className="divider"></div></div><a className="nectar-button medium regular extra-color-2 has-icon  regular-button" role="button" href="https://leangenbukta.no/om-prosjektet/" data-color-override="false" data-hover-color-override="false" data-hover-text-color-override="#fff"><span>Les mer om prosjektet</span><i><span className="im-icon-wrap"><span><svg role="presentation" version="1.1" xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <path d="M28.328 20c-0.145 0-0.295-0.048-0.417-0.145-0.288-0.229-0.333-0.648-0.103-0.937l2.331-2.917-2.331-2.916c-0.231-0.287-0.185-0.708 0.103-0.937 0.291-0.231 0.708-0.184 0.937 0.104l2.665 3.333c0.195 0.244 0.195 0.589 0 0.833l-2.665 3.333c-0.131 0.164-0.324 0.249-0.52 0.249zM30.341 16.667h-29.333c-0.367 0-0.667-0.299-0.667-0.667s0.3-0.667 0.667-0.667h29.333c0.367 0 0.667 0.299 0.667 0.667s-0.3 0.667-0.667 0.667z"></path>
    </svg></span></span></i></a>
    </div>
    </div>
    </div>
    </div></div>
    <div id="8godegrunner" data-column-margin="default" data-midnight="dark" className="wpb_row vc_row-fluid vc_row full-width-content vc_row-o-equal-height vc_row-flex vc_row-o-content-top hash" style={{ paddingTop: "10px", paddingBottom: "0px" }}><div className="row-bg-wrap" data-bg-animation="none" data-bg-animation-delay="" data-bg-overlay="false"><div className="inner-wrap row-bg-layer"><div className="row-bg viewport-desktop"></div></div></div><div className="row_col_wrap_12 col span_12 dark left">
    <div style={{ color: "#2a2c2e" }} className="vc_col-sm-6 border-right wpb_column column_container vc_column_container col padding-6-percent inherit_tablet inherit_phone flex_gap_desktop_10px " data-cfc="true" data-using-bg="true" data-padding-pos="all" data-has-bg-color="true" data-bg-color="#d6c6b7" data-bg-opacity="1" data-animation="" data-delay="0">
    <div className="vc_column-inner"><div className="column-bg-overlay-wrap column-bg-layer" data-bg-animation="none"><div className="column-bg-overlay" style={{ opacity: "1", backgroundColor: "#d6c6b7" }}></div></div>
    <div className="wpb_wrapper">
    <div className="wpb_text_column wpb_content_element ">
    <h3><strong><span style={{ color: "#2a2c2e" }}>PARKTUNET 1- DEN NYE DELEN AV LEANGENBUKTA</span></strong></h3>
    </div>
    <div className="wpb_text_column wpb_content_element ">
    <p><strong>Leiligheter fra 37,5- 107 <span className="ILfuVd"><span className="hgKElc">m² </span></span></strong></p>
    <p><strong>Estimert ferdigstilt i 2028.</strong></p>
    </div>
    <div className="divider-wrap" data-alignment="default"><div style={{ height: "15px" }} className="divider"></div></div>
    <div className="wpb_text_column wpb_content_element ">
    <p>Parktunet får en flott beliggenhet mot Torget og Aktivitetsparken. Her bor du i grønne og luftige omgivelser, med kort vei til Ladestien og handel og kollektivtransport på Lade.</p>
    </div>
    <div className="divider-wrap" data-alignment="default"><div style={{ height: "15px" }} className="divider"></div></div><a className="nectar-button medium regular extra-color-2 has-icon  regular-button" role="button" href="https://www.leangenbukta.no/parktunet1" data-color-override="false" data-hover-color-override="false" data-hover-text-color-override="#fff"><span>Les mer om Parktunet 1</span><i><span className="im-icon-wrap"><span><svg role="presentation" version="1.1" xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <path d="M28.328 20c-0.145 0-0.295-0.048-0.417-0.145-0.288-0.229-0.333-0.648-0.103-0.937l2.331-2.917-2.331-2.916c-0.231-0.287-0.185-0.708 0.103-0.937 0.291-0.231 0.708-0.184 0.937 0.104l2.665 3.333c0.195 0.244 0.195 0.589 0 0.833l-2.665 3.333c-0.131 0.164-0.324 0.249-0.52 0.249zM30.341 16.667h-29.333c-0.367 0-0.667-0.299-0.667-0.667s0.3-0.667 0.667-0.667h29.333c0.367 0 0.667 0.299 0.667 0.667s-0.3 0.667-0.667 0.667z"></path>
    </svg></span></span></i></a><div className="divider-wrap" data-alignment="default"><div style={{ height: "15px" }} className="divider"></div></div><a className="nectar-button medium regular extra-color-2 has-icon  regular-button" role="button" href="https://leangenbukta.plyo.cloud/?y=33&p=0&point=1741545619853&selected=ByggD" data-color-override="false" data-hover-color-override="false" data-hover-text-color-override="#fff"><span>Se ledige leiligheter</span><i><span className="im-icon-wrap"><span><svg role="presentation" version="1.1" xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <path d="M28.328 20c-0.145 0-0.295-0.048-0.417-0.145-0.288-0.229-0.333-0.648-0.103-0.937l2.331-2.917-2.331-2.916c-0.231-0.287-0.185-0.708 0.103-0.937 0.291-0.231 0.708-0.184 0.937 0.104l2.665 3.333c0.195 0.244 0.195 0.589 0 0.833l-2.665 3.333c-0.131 0.164-0.324 0.249-0.52 0.249zM30.341 16.667h-29.333c-0.367 0-0.667-0.299-0.667-0.667s0.3-0.667 0.667-0.667h29.333c0.367 0 0.667 0.299 0.667 0.667s-0.3 0.667-0.667 0.667z"></path>
    </svg></span></span></i></a><div className="divider-wrap" data-alignment="default"><div style={{ height: "15px" }} className="divider"></div></div>
    </div>
    </div>
    </div>
    <div style={{ color: "#ffffff" }} className="vc_col-sm-6 vc_hidden-sm vc_hidden-xs border-left wpb_column column_container vc_column_container col has-animation no-extra-padding inherit_tablet inherit_phone " data-cfc="true" data-using-bg="true" data-bg-cover="true" data-padding-pos="all" data-has-bg-color="false" data-bg-color="" data-bg-opacity="1" data-animation="fade-in-from-right" data-delay="0">
    <div className="vc_column-inner"><div className="column-image-bg-wrap column-bg-layer viewport-desktop" data-bg-pos="center center" data-bg-animation="none" data-bg-overlay="false"><div className="inner-wrap"><div className="column-image-bg" style={{ backgroundImage: "url('/demo/leangenbukta-nettside/leangenbukta-bygg-d_Eksterior_Vinkel-02_Miljobil-608151.jpg')" }}></div></div></div>
    <div className="wpb_wrapper">
    </div>
    </div>
    </div>
    </div></div>
    <div id="8godegrunner" data-column-margin="default" data-midnight="dark" className="wpb_row vc_row-fluid vc_row full-width-content vc_row-o-equal-height vc_row-flex vc_row-o-content-top hash" style={{ paddingTop: "10px", paddingBottom: "0px" }}><div className="row-bg-wrap" data-bg-animation="none" data-bg-animation-delay="" data-bg-overlay="false"><div className="inner-wrap row-bg-layer"><div className="row-bg viewport-desktop"></div></div></div><div className="row_col_wrap_12 col span_12 dark left">
    <div style={{ color: "#2a2c2e" }} className="vc_col-sm-12 vc_hidden-lg vc_hidden-md border-right wpb_column column_container vc_column_container col padding-6-percent inherit_tablet inherit_phone flex_gap_desktop_10px " data-cfc="true" data-using-bg="true" data-padding-pos="all" data-has-bg-color="true" data-bg-color="#d6c6b7" data-bg-opacity="1" data-animation="" data-delay="0">
    <div className="vc_column-inner"><div className="column-bg-overlay-wrap column-bg-layer" data-bg-animation="none"><div className="column-bg-overlay" style={{ opacity: "1", backgroundColor: "#d6c6b7" }}></div></div>
    <div className="wpb_wrapper">
    <div className="img-with-aniamtion-wrap center" data-max-width="100%" data-max-width-mobile="default" data-shadow="none" data-animation="none">
    <div className="inner">
    <div className="hover-wrap">
    <div className="hover-wrap-inner">
    <Image className="img-with-animation skip-lazy" data-animation="none" src="/demo/leangenbukta-nettside/Leangenbukta_Bygg-C_Eksterior_Vinkel-02_v2_Plyo-1e252b.jpg" alt="" width={1800} height={1350} />
    </div>
    </div>
    </div>
    </div>
    </div>
    </div>
    </div>
    </div></div>
    <div id="prosjektet" data-column-margin="default" data-midnight="dark" className="wpb_row vc_row-fluid vc_row full-width-content vc_row-o-equal-height vc_row-flex vc_row-o-content-top hash" style={{ paddingTop: "10px", paddingBottom: "0px" }}><div className="row-bg-wrap" data-bg-animation="none" data-bg-animation-delay="" data-bg-overlay="false"><div className="inner-wrap row-bg-layer"><div className="row-bg viewport-desktop"></div></div></div><div className="row_col_wrap_12 col span_12 dark left">
    <div style={{ color: "#ffffff" }} className="vc_col-sm-6 vc_hidden-sm vc_hidden-xs border-right wpb_column column_container vc_column_container col has-animation no-extra-padding inherit_tablet inherit_phone " data-cfc="true" data-using-bg="true" data-bg-cover="true" data-padding-pos="all" data-has-bg-color="false" data-bg-color="" data-bg-opacity="1" data-animation="fade-in-from-right" data-delay="0">
    <div className="vc_column-inner"><div className="column-image-bg-wrap column-bg-layer viewport-desktop" data-bg-pos="center center" data-bg-animation="none" data-bg-overlay="false"><div className="inner-wrap"><div className="column-image-bg" style={{ backgroundImage: "url('/demo/leangenbukta-nettside/Leangenbukta_Bygg-C_Eksterior_Vinkel-01_v2_Plyo-364c2a.jpg')" }}></div></div></div>
    <div className="wpb_wrapper">
    </div>
    </div>
    </div>
    <div style={{ color: "#2a2c2e" }} className="vc_col-sm-6 border-left wpb_column column_container vc_column_container col padding-6-percent inherit_tablet inherit_phone flex_gap_desktop_10px " data-cfc="true" data-using-bg="true" data-padding-pos="all" data-has-bg-color="true" data-bg-color="#d6c6b7" data-bg-opacity="1" data-animation="" data-delay="0">
    <div className="vc_column-inner"><div className="column-bg-overlay-wrap column-bg-layer" data-bg-animation="none"><div className="column-bg-overlay" style={{ opacity: "1", backgroundColor: "#d6c6b7" }}></div></div>
    <div className="wpb_wrapper">
    <div className="wpb_text_column wpb_content_element ">
    </div>
    <div className="wpb_text_column wpb_content_element ">
    <h3><strong>SALTAKSHUS C </strong></h3>
    </div>
    <div className="divider-wrap" data-alignment="default"><div style={{ height: "15px" }} className="divider"></div></div>
    <div className="wpb_text_column wpb_content_element ">
    <div className="" data-block="true" data-editor="2lbqn" data-offset-key="elqq2-0-0">
    <p><strong>Leiligheter fra 41-79 m<span className="ILfuVd"><span className="hgKElc">²</span></span></strong></p>
    <p><strong>Bygging igangsatt. Estimert ferdigstilt i 2027/ 2028.</strong></p>
    </div>
    </div>
    <div className="wpb_text_column wpb_content_element ">
    <p>Saltakshus C består av 34 leiligheter. Bygget er plassert mellom det sjarmerende torget på den ene siden, og ut mot Lade allé på den andre.</p>
    </div>
    <a className="nectar-button medium regular extra-color-2 has-icon  regular-button" role="button" href="https://leangenbukta.no/saltakshusc/" data-color-override="false" data-hover-color-override="false" data-hover-text-color-override="#fff"><span>Les mer om Saltakshus C</span><i><span className="im-icon-wrap"><span><svg role="presentation" version="1.1" xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <path d="M28.328 20c-0.145 0-0.295-0.048-0.417-0.145-0.288-0.229-0.333-0.648-0.103-0.937l2.331-2.917-2.331-2.916c-0.231-0.287-0.185-0.708 0.103-0.937 0.291-0.231 0.708-0.184 0.937 0.104l2.665 3.333c0.195 0.244 0.195 0.589 0 0.833l-2.665 3.333c-0.131 0.164-0.324 0.249-0.52 0.249zM30.341 16.667h-29.333c-0.367 0-0.667-0.299-0.667-0.667s0.3-0.667 0.667-0.667h29.333c0.367 0 0.667 0.299 0.667 0.667s-0.3 0.667-0.667 0.667z"></path>
    </svg></span></span></i></a><div className="divider-wrap" data-alignment="default"><div style={{ height: "15px" }} className="divider"></div></div><a className="nectar-button medium regular extra-color-2 has-icon  regular-button" role="button" href="https://leangenbukta.plyo.cloud/?y=123&p=0&point=1440249548096&selected=ByggC" data-color-override="false" data-hover-color-override="false" data-hover-text-color-override="#fff"><span>Se ledige leiligheter</span><i><span className="im-icon-wrap"><span><svg role="presentation" version="1.1" xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <path d="M28.328 20c-0.145 0-0.295-0.048-0.417-0.145-0.288-0.229-0.333-0.648-0.103-0.937l2.331-2.917-2.331-2.916c-0.231-0.287-0.185-0.708 0.103-0.937 0.291-0.231 0.708-0.184 0.937 0.104l2.665 3.333c0.195 0.244 0.195 0.589 0 0.833l-2.665 3.333c-0.131 0.164-0.324 0.249-0.52 0.249zM30.341 16.667h-29.333c-0.367 0-0.667-0.299-0.667-0.667s0.3-0.667 0.667-0.667h29.333c0.367 0 0.667 0.299 0.667 0.667s-0.3 0.667-0.667 0.667z"></path>
    </svg></span></span></i></a>
    <div className="wpb_text_column wpb_content_element ">
    </div>
    <div className="wpb_text_column wpb_content_element ">
    </div>
    </div>
    </div>
    </div>
    </div></div>
    <div id="8godegrunner" data-column-margin="default" data-midnight="dark" className="wpb_row vc_row-fluid vc_row full-width-content vc_row-o-equal-height vc_row-flex vc_row-o-content-top hash" style={{ paddingTop: "10px", paddingBottom: "0px" }}><div className="row-bg-wrap" data-bg-animation="none" data-bg-animation-delay="" data-bg-overlay="false"><div className="inner-wrap row-bg-layer"><div className="row-bg viewport-desktop"></div></div></div><div className="row_col_wrap_12 col span_12 dark left">
    <div style={{ color: "#2a2c2e" }} className="vc_col-sm-12 vc_hidden-lg vc_hidden-md border-right wpb_column column_container vc_column_container col padding-6-percent inherit_tablet inherit_phone flex_gap_desktop_10px " data-cfc="true" data-using-bg="true" data-padding-pos="all" data-has-bg-color="true" data-bg-color="#d6c6b7" data-bg-opacity="1" data-animation="" data-delay="0">
    <div className="vc_column-inner"><div className="column-bg-overlay-wrap column-bg-layer" data-bg-animation="none"><div className="column-bg-overlay" style={{ opacity: "1", backgroundColor: "#d6c6b7" }}></div></div>
    <div className="wpb_wrapper">
    <div className="img-with-aniamtion-wrap center" data-max-width="100%" data-max-width-mobile="default" data-shadow="none" data-animation="none">
    <div className="inner">
    <div className="hover-wrap">
    <div className="hover-wrap-inner">
    <Image className="img-with-animation skip-lazy" data-animation="none" src="/demo/leangenbukta-nettside/Leangenbukta_Eksterior_Boligvelger-02_Bygg_E_Ost-9f90bf.jpg" alt="" width={1800} height={1350} />
    </div>
    </div>
    </div>
    </div>
    </div>
    </div>
    </div>
    </div></div>
    <div id="8godegrunner" data-column-margin="default" data-midnight="dark" className="wpb_row vc_row-fluid vc_row full-width-content vc_row-o-equal-height vc_row-flex vc_row-o-content-top hash" style={{ paddingTop: "10px", paddingBottom: "0px" }}><div className="row-bg-wrap" data-bg-animation="none" data-bg-animation-delay="" data-bg-overlay="false"><div className="inner-wrap row-bg-layer"><div className="row-bg viewport-desktop"></div></div></div><div className="row_col_wrap_12 col span_12 dark left">
    <div style={{ color: "#2a2c2e" }} className="vc_col-sm-6 border-right wpb_column column_container vc_column_container col padding-6-percent inherit_tablet inherit_phone flex_gap_desktop_10px " data-cfc="true" data-using-bg="true" data-padding-pos="all" data-has-bg-color="true" data-bg-color="#d6c6b7" data-bg-opacity="1" data-animation="" data-delay="0">
    <div className="vc_column-inner"><div className="column-bg-overlay-wrap column-bg-layer" data-bg-animation="none"><div className="column-bg-overlay" style={{ opacity: "1", backgroundColor: "#d6c6b7" }}></div></div>
    <div className="wpb_wrapper">
    <div className="wpb_text_column wpb_content_element ">
    <h3><strong><span style={{ color: "#2a2c2e" }}>KNUTEPUNKTET</span></strong></h3>
    </div>
    <div className="wpb_text_column wpb_content_element ">
    <p><strong>Leiligheter fra 27,5- 71 <span className="ILfuVd"><span className="hgKElc">m² </span></span></strong></p>
    <p><strong><span className="ILfuVd"><span className="hgKElc">Innflytting i siste kvartal 2026</span></span></strong></p>
    </div>
    <div className="divider-wrap" data-alignment="default"><div style={{ height: "15px" }} className="divider"></div></div>
    <div className="wpb_text_column wpb_content_element ">
    <p>Knutepunktet består av 28 leiligheter og huser alle Leangenbuktas felles fasiliteter som treningsrom, lounge, selskapsrom og gjesterom.</p>
    </div>
    <div className="divider-wrap" data-alignment="default"><div style={{ height: "15px" }} className="divider"></div></div><a className="nectar-button medium regular extra-color-2 has-icon  regular-button" role="button" href="https://leangenbukta.no/knutepunktet/" data-color-override="false" data-hover-color-override="false" data-hover-text-color-override="#fff"><span>Les mer om Knutepunktet</span><i><span className="im-icon-wrap"><span><svg role="presentation" version="1.1" xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <path d="M28.328 20c-0.145 0-0.295-0.048-0.417-0.145-0.288-0.229-0.333-0.648-0.103-0.937l2.331-2.917-2.331-2.916c-0.231-0.287-0.185-0.708 0.103-0.937 0.291-0.231 0.708-0.184 0.937 0.104l2.665 3.333c0.195 0.244 0.195 0.589 0 0.833l-2.665 3.333c-0.131 0.164-0.324 0.249-0.52 0.249zM30.341 16.667h-29.333c-0.367 0-0.667-0.299-0.667-0.667s0.3-0.667 0.667-0.667h29.333c0.367 0 0.667 0.299 0.667 0.667s-0.3 0.667-0.667 0.667z"></path>
    </svg></span></span></i></a><div className="divider-wrap" data-alignment="default"><div style={{ height: "15px" }} className="divider"></div></div><a className="nectar-button medium regular extra-color-2 has-icon  regular-button" role="button" href="https://leangenbukta.plyo.cloud/?y=245&p=5&point=1440249576384&selected=ByggE" data-color-override="false" data-hover-color-override="false" data-hover-text-color-override="#fff"><span>Se ledige leiligheter</span><i><span className="im-icon-wrap"><span><svg role="presentation" version="1.1" xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <path d="M28.328 20c-0.145 0-0.295-0.048-0.417-0.145-0.288-0.229-0.333-0.648-0.103-0.937l2.331-2.917-2.331-2.916c-0.231-0.287-0.185-0.708 0.103-0.937 0.291-0.231 0.708-0.184 0.937 0.104l2.665 3.333c0.195 0.244 0.195 0.589 0 0.833l-2.665 3.333c-0.131 0.164-0.324 0.249-0.52 0.249zM30.341 16.667h-29.333c-0.367 0-0.667-0.299-0.667-0.667s0.3-0.667 0.667-0.667h29.333c0.367 0 0.667 0.299 0.667 0.667s-0.3 0.667-0.667 0.667z"></path>
    </svg></span></span></i></a><div className="divider-wrap" data-alignment="default"><div style={{ height: "15px" }} className="divider"></div></div>
    </div>
    </div>
    </div>
    <div style={{ color: "#ffffff" }} className="vc_col-sm-6 vc_hidden-sm vc_hidden-xs border-left wpb_column column_container vc_column_container col has-animation no-extra-padding inherit_tablet inherit_phone " data-cfc="true" data-using-bg="true" data-bg-cover="true" data-padding-pos="all" data-has-bg-color="false" data-bg-color="" data-bg-opacity="1" data-animation="fade-in-from-right" data-delay="0">
    <div className="vc_column-inner"><div className="column-image-bg-wrap column-bg-layer viewport-desktop" data-bg-pos="center center" data-bg-animation="none" data-bg-overlay="false"><div className="inner-wrap"><div className="column-image-bg" style={{ backgroundImage: "url('/demo/leangenbukta-nettside/Leangenbukta_Eksterior_Boligvelger-02_Bygg_E_Ost-9f90bf.jpg')" }}></div></div></div>
    <div className="wpb_wrapper">
    </div>
    </div>
    </div>
    </div></div>
    <div id="8godegrunner" data-column-margin="default" data-midnight="dark" className="wpb_row vc_row-fluid vc_row full-width-content vc_row-o-equal-height vc_row-flex vc_row-o-content-top hash" style={{ paddingTop: "10px", paddingBottom: "0px" }}><div className="row-bg-wrap" data-bg-animation="none" data-bg-animation-delay="" data-bg-overlay="false"><div className="inner-wrap row-bg-layer"><div className="row-bg viewport-desktop"></div></div></div><div className="row_col_wrap_12 col span_12 dark left">
    <div style={{ color: "#2a2c2e" }} className="vc_col-sm-12 vc_hidden-lg vc_hidden-md border-right wpb_column column_container vc_column_container col padding-6-percent inherit_tablet inherit_phone flex_gap_desktop_10px " data-cfc="true" data-using-bg="true" data-padding-pos="all" data-has-bg-color="true" data-bg-color="#d6c6b7" data-bg-opacity="1" data-animation="" data-delay="0">
    <div className="vc_column-inner"><div className="column-bg-overlay-wrap column-bg-layer" data-bg-animation="none"><div className="column-bg-overlay" style={{ opacity: "1", backgroundColor: "#d6c6b7" }}></div></div>
    <div className="wpb_wrapper">
    <div className="img-with-aniamtion-wrap center" data-max-width="100%" data-max-width-mobile="default" data-shadow="none" data-animation="none">
    <div className="inner">
    <div className="hover-wrap">
    <div className="hover-wrap-inner">
    <Image className="img-with-animation skip-lazy" data-animation="none" src="/demo/leangenbukta-nettside/Leangenbukta_Eksterior_Boligvelger-04_Bygg_H_Sor-fdb155.jpg" alt="" width={1800} height={1350} />
    </div>
    </div>
    </div>
    </div>
    </div>
    </div>
    </div>
    </div></div>
    <div id="prosjektet" data-column-margin="default" data-midnight="dark" className="wpb_row vc_row-fluid vc_row full-width-content vc_row-o-equal-height vc_row-flex vc_row-o-content-top hash" style={{ paddingTop: "10px", paddingBottom: "0px" }}><div className="row-bg-wrap" data-bg-animation="none" data-bg-animation-delay="" data-bg-overlay="false"><div className="inner-wrap row-bg-layer"><div className="row-bg viewport-desktop"></div></div></div><div className="row_col_wrap_12 col span_12 dark left">
    <div style={{ color: "#ffffff" }} className="vc_col-sm-6 vc_hidden-sm vc_hidden-xs border-right wpb_column column_container vc_column_container col has-animation no-extra-padding inherit_tablet inherit_phone " data-cfc="true" data-using-bg="true" data-bg-cover="true" data-padding-pos="all" data-has-bg-color="false" data-bg-color="" data-bg-opacity="1" data-animation="fade-in-from-right" data-delay="0">
    <div className="vc_column-inner"><div className="column-image-bg-wrap column-bg-layer viewport-desktop" data-bg-pos="center center" data-bg-animation="none" data-bg-overlay="false"><div className="inner-wrap"><div className="column-image-bg" style={{ backgroundImage: "url('/demo/leangenbukta-nettside/Leangenbukta_Eksterior_Boligvelger-04_Bygg_H_Sor-fdb155.jpg')" }}></div></div></div>
    <div className="wpb_wrapper">
    </div>
    </div>
    </div>
    <div style={{ color: "#2a2c2e" }} className="vc_col-sm-6 border-left wpb_column column_container vc_column_container col padding-6-percent inherit_tablet inherit_phone flex_gap_desktop_10px " data-cfc="true" data-using-bg="true" data-padding-pos="all" data-has-bg-color="true" data-bg-color="#d6c6b7" data-bg-opacity="1" data-animation="" data-delay="0">
    <div className="vc_column-inner"><div className="column-bg-overlay-wrap column-bg-layer" data-bg-animation="none"><div className="column-bg-overlay" style={{ opacity: "1", backgroundColor: "#d6c6b7" }}></div></div>
    <div className="wpb_wrapper">
    <div className="wpb_text_column wpb_content_element ">
    </div>
    <div className="wpb_text_column wpb_content_element ">
    <h3><strong>SALTAKSHUS H </strong></h3>
    </div>
    <div className="wpb_text_column wpb_content_element ">
    <p><strong>Leiligheter fra 42- 109 <span className="ILfuVd"><span className="hgKElc">m²</span></span></strong></p>
    <p><strong>Innflyttingsklart</strong></p>
    </div>
    <div className="divider-wrap" data-alignment="default"><div style={{ height: "15px" }} className="divider"></div></div>
    <div className="wpb_text_column wpb_content_element ">
    <div className="" data-block="true" data-editor="2lbqn" data-offset-key="elqq2-0-0">
    <p><span data-offset-key="elqq2-0-0">Saltakshus H består av 32</span> leiligheter med private balkonger, utsikt mot det grønne området, og nærhet til torget på Leangenbukta.</p>
    </div>
    </div>
    <div className="wpb_text_column wpb_content_element ">
    </div>
    <a className="nectar-button medium regular extra-color-2 has-icon  regular-button" role="button" href="https://leangenbukta.no/saltakshush/" data-color-override="false" data-hover-color-override="false" data-hover-text-color-override="#fff"><span>Les mer om Saltakshus H</span><i><span className="im-icon-wrap"><span><svg role="presentation" version="1.1" xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <path d="M28.328 20c-0.145 0-0.295-0.048-0.417-0.145-0.288-0.229-0.333-0.648-0.103-0.937l2.331-2.917-2.331-2.916c-0.231-0.287-0.185-0.708 0.103-0.937 0.291-0.231 0.708-0.184 0.937 0.104l2.665 3.333c0.195 0.244 0.195 0.589 0 0.833l-2.665 3.333c-0.131 0.164-0.324 0.249-0.52 0.249zM30.341 16.667h-29.333c-0.367 0-0.667-0.299-0.667-0.667s0.3-0.667 0.667-0.667h29.333c0.367 0 0.667 0.299 0.667 0.667s-0.3 0.667-0.667 0.667z"></path>
    </svg></span></span></i></a><div className="divider-wrap" data-alignment="default"><div style={{ height: "15px" }} className="divider"></div></div><a className="nectar-button medium regular extra-color-2 has-icon  regular-button" role="button" href="https://leangenbukta.plyo.cloud/?y=180&p=27&point=1440249576640&selected=ByggH" data-color-override="false" data-hover-color-override="false" data-hover-text-color-override="#fff"><span>Se ledige leiligheter</span><i><span className="im-icon-wrap"><span><svg role="presentation" version="1.1" xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <path d="M28.328 20c-0.145 0-0.295-0.048-0.417-0.145-0.288-0.229-0.333-0.648-0.103-0.937l2.331-2.917-2.331-2.916c-0.231-0.287-0.185-0.708 0.103-0.937 0.291-0.231 0.708-0.184 0.937 0.104l2.665 3.333c0.195 0.244 0.195 0.589 0 0.833l-2.665 3.333c-0.131 0.164-0.324 0.249-0.52 0.249zM30.341 16.667h-29.333c-0.367 0-0.667-0.299-0.667-0.667s0.3-0.667 0.667-0.667h29.333c0.367 0 0.667 0.299 0.667 0.667s-0.3 0.667-0.667 0.667z"></path>
    </svg></span></span></i></a>
    <div className="wpb_text_column wpb_content_element ">
    </div>
    <div className="wpb_text_column wpb_content_element ">
    </div>
    </div>
    </div>
    </div>
    </div></div>
    <div id="prosjektet" data-column-margin="default" data-midnight="dark" className="wpb_row vc_row-fluid vc_row full-width-content vc_row-o-equal-height vc_row-flex vc_row-o-content-top hash" style={{ paddingTop: "5px", paddingBottom: "5px" }}><div className="row-bg-wrap" data-bg-animation="none" data-bg-animation-delay="" data-bg-overlay="false"><div className="inner-wrap row-bg-layer"><div className="row-bg viewport-desktop"></div></div></div><div className="row_col_wrap_12 col span_12 dark left">
    <div style={{ color: "#2a2c2e" }} className="vc_col-sm-6 vc_hidden-lg vc_hidden-md vc_hidden-sm vc_hidden-xs border-right wpb_column column_container vc_column_container col padding-6-percent inherit_tablet inherit_phone flex_gap_desktop_10px " data-cfc="true" data-using-bg="true" data-padding-pos="all" data-has-bg-color="true" data-bg-color="#d6c6b7" data-bg-opacity="1" data-animation="" data-delay="0">
    <div className="vc_column-inner"><div className="column-bg-overlay-wrap column-bg-layer" data-bg-animation="none"><div className="column-bg-overlay" style={{ opacity: "1", backgroundColor: "#d6c6b7" }}></div></div>
    <div className="wpb_wrapper">
    <div className="wpb_text_column wpb_content_element ">
    </div>
    <div className="wpb_text_column wpb_content_element ">
    <h3><strong>REKKEHUS 1-4<br />
    </strong></h3>
    </div>
    <div className="wpb_text_column wpb_content_element ">
    <h5><strong>124 <span className="ILfuVd"><span className="hgKElc">m²</span></span></strong></h5>
    </div>
    <div className="divider-wrap" data-alignment="default"><div style={{ height: "15px" }} className="divider"></div></div>
    <div className="wpb_text_column wpb_content_element ">
    <p>Rekkehus med 2 stuer, 4 soverom, vaskerom og egen hageflekk i en god beliggenhet i Leangenbukta. <a href="https://leangenbukta.no/byvilla-3-rekkehus1-4/">Finn ut mer</a></p>
    </div>
    <div className="divider-wrap" data-alignment="default"><div style={{ height: "15px" }} className="divider"></div></div>
    <div className="wpb_text_column wpb_content_element ">
    </div>
    <a className="nectar-button medium regular extra-color-2 has-icon  regular-button" role="button" href="https://leangenbukta.no/boligvelger/rekkehus/" data-color-override="false" data-hover-color-override="false" data-hover-text-color-override="#fff"><span>Se ledige Rekkehus</span><i><span className="im-icon-wrap"><span><svg role="presentation" version="1.1" xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <path d="M28.328 20c-0.145 0-0.295-0.048-0.417-0.145-0.288-0.229-0.333-0.648-0.103-0.937l2.331-2.917-2.331-2.916c-0.231-0.287-0.185-0.708 0.103-0.937 0.291-0.231 0.708-0.184 0.937 0.104l2.665 3.333c0.195 0.244 0.195 0.589 0 0.833l-2.665 3.333c-0.131 0.164-0.324 0.249-0.52 0.249zM30.341 16.667h-29.333c-0.367 0-0.667-0.299-0.667-0.667s0.3-0.667 0.667-0.667h29.333c0.367 0 0.667 0.299 0.667 0.667s-0.3 0.667-0.667 0.667z"></path>
    </svg></span></span></i></a>
    <div className="wpb_text_column wpb_content_element ">
    </div>
    </div>
    </div>
    </div>
    <div style={{ color: "#ffffff" }} className="vc_col-sm-6 vc_hidden-lg vc_hidden-md vc_hidden-sm vc_hidden-xs border-left wpb_column column_container vc_column_container col has-animation no-extra-padding inherit_tablet inherit_phone flex_gap_desktop_10px " data-cfc="true" data-using-bg="true" data-bg-cover="true" data-padding-pos="all" data-has-bg-color="false" data-bg-color="" data-bg-opacity="1" data-animation="fade-in-from-right" data-delay="0">
    <div className="vc_column-inner"><div className="column-image-bg-wrap column-bg-layer viewport-desktop" data-bg-pos="center center" data-bg-animation="none" data-bg-overlay="false"><div className="inner-wrap"><div className="column-image-bg" style={{ backgroundImage: "url('/demo/leangenbukta-nettside/2725-01-KNG-e-07_Townhouse_Courtyard_R02-17f232.jpg')" }}></div></div></div>
    <div className="wpb_wrapper">
    </div>
    </div>
    </div>
    </div></div>
    <div id="kart" data-column-margin="default" data-midnight="dark" className="wpb_row vc_row-fluid vc_row full-width-content has-row-bg-color vc_row-o-equal-height vc_row-flex vc_row-o-content-top" style={{ paddingTop: "0px", paddingBottom: "0px", "--row-bg-color": "#ffffff" } as React.CSSProperties}><div className="row-bg-wrap" data-bg-animation="none" data-bg-animation-delay="" data-bg-overlay="false"><div className="inner-wrap row-bg-layer"><div className="row-bg viewport-desktop using-bg-color" style={{ backgroundColor: "#ffffff" }}></div></div></div><div className="row_col_wrap_12 col span_12 dark left">
    <div className="vc_col-sm-12 vc_hidden-sm vc_hidden-xs wpb_column column_container vc_column_container col has-animation no-extra-padding inherit_tablet inherit_phone flex_gap_desktop_10px " data-padding-pos="all" data-has-bg-color="false" data-bg-color="" data-bg-opacity="1" data-animation="fade-in-from-bottom" data-delay="0">
    <div className="vc_column-inner">
    <div className="wpb_wrapper">
    <div className="img-with-aniamtion-wrap center" data-max-width="100%" data-max-width-mobile="200%" data-shadow="none" data-animation="fade-in">
    <div className="inner">
    <div className="hover-wrap">
    <div className="hover-wrap-inner">
    <a href="/demo/leangenbukta-nettside/Kart-over-leangenbukta-1-b06a38.png" className="pp center">
    <Image className="img-with-animation skip-lazy" data-animation="fade-in" src="/demo/leangenbukta-nettside/Kart-over-leangenbukta-1-b06a38.png" alt="" width={1754} height={1240} />
    </a>
    </div>
    </div>
    </div>
    </div>
    </div>
    </div>
    </div>
    </div></div>
    {placyBlock}

    <div className="nectar-global-section nectar_hook_global_section_after_content"><div className="container normal-container row">
    <div id="kontakt" data-column-margin="default" data-midnight="dark" className="wpb_row vc_row-fluid vc_row full-width-section parallax_section hash" style={{ paddingTop: "80px", paddingBottom: "80px" }}><div className="row-bg-wrap" data-bg-animation="none" data-bg-animation-delay="" data-bg-overlay="false"><div className="inner-wrap row-bg-layer using-image"><div className="row-bg viewport-desktop using-image using-bg-color" data-parallax-speed="fast" style={{ backgroundImage: "url()", backgroundPosition: "center center", backgroundRepeat: "no-repeat", backgroundColor: "#cfd2d3" }}></div></div></div><div className="row_col_wrap_12 col span_12 dark left">
    <div className="vc_col-sm-6 wpb_column column_container vc_column_container col has-animation padding-4-percent force-tablet-text-align-center inherit_tablet inherit_phone flex_gap_desktop_10px " data-padding-pos="left-right" data-has-bg-color="false" data-bg-color="" data-bg-opacity="1" data-animation="fade-in-from-left" data-delay="0">
    <div className="vc_column-inner">
    <div className="wpb_wrapper">
    <div className="wpb_text_column wpb_content_element ">
    <p style={{ color: "#91563e", textAlign: "left" }}><span style={{ fontSize: "2em", fontWeight: "bold", textTransform: "uppercase" }}>Meld din interesse</span></p>
    </div>
    <div className="divider-wrap" data-alignment="default"><div style={{ height: "10px" }} className="divider"></div></div>
    <div className="wpcf7 no-js" id="wpcf7-f5-o1" lang="en-US" dir="ltr" data-wpcf7-id="5">
    <div className="screen-reader-response"><p role="status" aria-live="polite" aria-atomic="true"></p> <ul></ul></div>
    <form method="dialog" data-demo-inert="true" className="wpcf7-form init chimpmatic-18200 126d6c59a88a cmatic-conn cmatic-aud-12 cmatic-mapd0-0 cmatic-098113 cmatic-pro-18200 cmatic-sent-0 cmatic-total-4229" aria-label="Contact form" noValidate={true} data-status="init">
    <fieldset className="hidden-fields-container"><input type="hidden" name="_wpcf7" value="5" /><input type="hidden" name="_wpcf7_version" value="6.1.7" /><input type="hidden" name="_wpcf7_locale" value="en_US" /><input type="hidden" name="_wpcf7_unit_tag" value="wpcf7-f5-o1" /><input type="hidden" name="_wpcf7_container_post" value="0" /><input type="hidden" name="_wpcf7_posted_data_hash" value="" /><input type="hidden" name="_wpcf7dtx_version" value="5.0.7" /><input type="hidden" name="_wpcf7_recaptcha_response" value="" />
    </fieldset>
    <p>Meld deg på nyhetsbrev for å holde deg oppdatert om Leangenbukta.
    </p>
    <p className="checkbox-group"><span className="wpcf7-form-control-wrap" data-name="antall-rom"><span className="wpcf7-form-control wpcf7-checkbox"><span className="wpcf7-list-item first"><label><input type="checkbox" name="antall-rom[]" value="2-roms" /><span className="wpcf7-list-item-label">2-roms</span></label></span><span className="wpcf7-list-item"><label><input type="checkbox" name="antall-rom[]" value="3-roms" /><span className="wpcf7-list-item-label">3-roms</span></label></span><span className="wpcf7-list-item"><label><input type="checkbox" name="antall-rom[]" value="4-roms" /><span className="wpcf7-list-item-label">4-roms</span></label></span><span className="wpcf7-list-item last"><label><input type="checkbox" name="antall-rom[]" value="Rekkehus" /><span className="wpcf7-list-item-label">Rekkehus</span></label></span></span></span>
    </p>
    <p className="subtitle">Velg ett eller flere alternativer
    </p>
    <span className="wpcf7-form-control-wrap RegistreringSide" data-name="RegistreringSide"><input type="hidden" name="RegistreringSide" className="wpcf7-form-control wpcf7-hidden wpcf7dtx wpcf7dtx-hidden" aria-invalid="false" value="Leangbukta Hovedside" /></span>
    <div style={{ padding: "0" }}>
    <p><span className="wpcf7-form-control-wrap" data-name="firstName"><input size={40} maxLength={400} className="wpcf7-form-control wpcf7-text wpcf7-validates-as-required" aria-required="true" aria-invalid="false" placeholder="Fornavn*" defaultValue="" type="text" name="firstName" /></span>
    </p>
    </div>
    <div style={{ padding: "0" }}>
    <p><span className="wpcf7-form-control-wrap" data-name="lastName"><input size={40} maxLength={400} className="wpcf7-form-control wpcf7-text wpcf7-validates-as-required" aria-required="true" aria-invalid="false" placeholder="Etternavn*" defaultValue="" type="text" name="lastName" /></span>
    </p>
    </div>
    <div style={{ padding: "0" }}>
    <p><span className="wpcf7-form-control-wrap" data-name="email"><input size={40} maxLength={400} className="wpcf7-form-control wpcf7-email wpcf7-validates-as-required wpcf7-text wpcf7-validates-as-email" aria-required="true" aria-invalid="false" placeholder="E-post*" defaultValue="" type="email" name="email" /></span>
    </p>
    </div>
    <div style={{ padding: "0 0 15px 0" }}>
    <p><span className="wpcf7-form-control-wrap" data-name="mobilePhone"><input size={40} maxLength={400} className="wpcf7-form-control wpcf7-text" aria-invalid="false" placeholder="Telefon" defaultValue="" type="text" name="mobilePhone" /></span>
    </p>
    </div>
    <p><span className="wpcf7-form-control-wrap" data-name="samtykke"><span className="wpcf7-form-control wpcf7-checkbox wpcf7-validates-as-required"><span className="wpcf7-list-item first last"><label><input type="checkbox" name="samtykke[]" value="Jeg gir herved samtykke til \u00e5 bli kontaktet via e-post og telefon med relevant informasjon om dette prosjektet." /><span className="wpcf7-list-item-label">Jeg gir herved samtykke til å bli kontaktet via e-post og telefon med relevant informasjon om dette prosjektet.</span></label></span></span></span><a href="https://leangenbukta.no/personvern/" target="_blank">Se personvernpolicy</a>
    </p>
    <div style={{ padding: "0" }}>
    <p><input className="wpcf7-form-control wpcf7-submit has-spinner nectar-button medium accent-color" type="submit" value="Send" />
    </p>
    </div><div className="wpcf7-response-output" aria-hidden="true"></div>
    </form>
    </div>
    <div id="fws_6aaab6eb16dc0" data-midnight="" data-column-margin="default" className="wpb_row vc_row-fluid vc_row inner_row"><div className="row-bg-wrap"> <div className="row-bg"></div> </div><div className="row_col_wrap_12_inner col span_12  left">
    <div className="vc_col-sm-6 wpb_column column_container vc_column_container col child_column no-extra-padding inherit_tablet inherit_phone flex_gap_desktop_10px " data-padding-pos="all" data-has-bg-color="false" data-bg-color="" data-bg-opacity="1" data-animation="" data-delay="0">
    <div className="vc_column-inner">
    <div className="wpb_wrapper">
    <div className="img-with-aniamtion-wrap " data-max-width="100%" data-max-width-mobile="default" data-shadow="none" data-animation="fade-in">
    <div className="inner">
    <div className="hover-wrap">
    <div className="hover-wrap-inner">
    <a href="https://koteng.no/koteng-jenssen/" target="_self" className="">
    <Image className="img-with-animation logo kotenglogo skip-lazy" data-animation="fade-in" src="/demo/leangenbukta-nettside/Koteng_Jenssen_Logo_Liggende_Mork_Svart-80da07.png" alt="" width={2927} height={398} />
    </a>
    </div>
    </div>
    </div>
    </div>
    </div>
    </div>
    </div>
    <div className="vc_col-sm-6 wpb_column column_container vc_column_container col child_column no-extra-padding inherit_tablet inherit_phone flex_gap_desktop_10px " data-padding-pos="all" data-has-bg-color="false" data-bg-color="" data-bg-opacity="1" data-animation="" data-delay="0">
    <div className="vc_column-inner">
    <div className="wpb_wrapper">
    <div className="img-with-aniamtion-wrap " data-max-width="100%" data-max-width-mobile="default" data-shadow="none" data-animation="fade-in">
    <div className="inner">
    <div className="hover-wrap">
    <div className="hover-wrap-inner">
    <a href="http://www.obos.no" target="_blank" className="">
    <Image className="img-with-animation logo oboslogo skip-lazy" data-animation="fade-in" src="/demo/leangenbukta-nettside/obos_liggende-0b7b07.png" alt="" width={999} height={220} />
    </a>
    </div>
    </div>
    </div>
    </div>
    </div>
    </div>
    </div>
    </div></div>
    </div>
    </div>
    </div>
    <div className="vc_col-sm-6 megler left-stripe wpb_column column_container vc_column_container col padding-4-percent force-phone-text-align-center inherit_tablet inherit_phone " data-padding-pos="left-right" data-has-bg-color="false" data-bg-color="" data-bg-opacity="1" data-animation="" data-delay="0">
    <div className="vc_column-inner">
    <div className="wpb_wrapper">
    <div className="wpb_text_column wpb_content_element ">
    <p style={{ color: "#91563e", textAlign: "left" }}><span style={{ fontSize: "2em", fontWeight: "bold", textTransform: "uppercase" }}>Kontakt</span></p>
    </div>
    <div className="divider-wrap" data-alignment="default"><div style={{ height: "10px" }} className="divider"></div></div><div className="img-with-aniamtion-wrap " data-max-width="50%" data-max-width-mobile="default" data-shadow="none" data-animation="fade-in">
    <div className="inner">
    <div className="hover-wrap">
    <div className="hover-wrap-inner">
    <Image className="img-with-animation logo leangenbukta skip-lazy" data-animation="fade-in" src="/demo/leangenbukta-nettside/Leangenbukta_brown_01-270fa8.svg" alt="" width={1100} height={91} unoptimized />
    </div>
    </div>
    </div>
    </div><div className="divider-wrap" data-alignment="default"><div style={{ height: "10px" }} className="divider"></div></div><div id="fws_6aaab6eb18589" data-midnight="" data-column-margin="default" className="wpb_row vc_row-fluid vc_row inner_row"><div className="row-bg-wrap"> <div className="row-bg"></div> </div><div className="row_col_wrap_12_inner col span_12  left">
    <div className="vc_col-sm-12 vc_col-xs-6 wpb_column column_container vc_column_container col child_column no-extra-padding inherit_tablet inherit_phone flex_gap_desktop_10px " data-t-w-inherits="small_desktop" data-padding-pos="all" data-has-bg-color="false" data-bg-color="" data-bg-opacity="1" data-animation="" data-delay="0">
    <div className="vc_column-inner">
    <div className="wpb_wrapper">
    <div className="divider-wrap" data-alignment="default"><div style={{ height: "10px" }} className="divider"></div></div>
    </div>
    </div>
    </div>
    </div></div><div id="fws_6aaab6eb18841" data-midnight="" data-column-margin="default" className="wpb_row vc_row-fluid vc_row inner_row"><div className="row-bg-wrap"> <div className="row-bg"></div> </div><div className="row_col_wrap_12_inner col span_12  left">
    <div className="vc_col-sm-6 wpb_column column_container vc_column_container col child_column no-extra-padding inherit_tablet inherit_phone flex_gap_desktop_10px " data-padding-pos="all" data-has-bg-color="false" data-bg-color="" data-bg-opacity="1" data-animation="" data-delay="0">
    <div className="vc_column-inner">
    <div className="wpb_wrapper">
    <div className="img-with-aniamtion-wrap " data-max-width="100%" data-max-width-mobile="default" data-shadow="none" data-animation="fade-in">
    <div className="inner">
    <div className="hover-wrap">
    <div className="hover-wrap-inner">
    <Image className="img-with-animation salgslederbilde skip-lazy" data-animation="fade-in" src="/demo/leangenbukta-nettside/Mari-9efeb0.jpg" alt="" width={750} height={1000} />
    </div>
    </div>
    </div>
    </div>
    <div className="wpb_text_column wpb_content_element  mont-marius">
    <p><strong>Mari Østgaard Buaas</strong><br />
    Prosjektselger<br />
    <a href="mailto:mari.buaas@koteng.no" target="_blank" rel="noopener noreferrer">mari.buaas@koteng.no</a><br />
    <a href="tel:948 11 965">948 11 965</a></p>
    </div>
    </div>
    </div>
    </div>
    <div className="vc_col-sm-6 wpb_column column_container vc_column_container col child_column no-extra-padding inherit_tablet inherit_phone flex_gap_desktop_10px " data-padding-pos="all" data-has-bg-color="false" data-bg-color="" data-bg-opacity="1" data-animation="" data-delay="0">
    <div className="vc_column-inner">
    <div className="wpb_wrapper">
    <div className="img-with-aniamtion-wrap " data-max-width="100%" data-max-width-mobile="default" data-shadow="none" data-animation="fade-in">
    <div className="inner">
    <div className="hover-wrap">
    <div className="hover-wrap-inner">
    <Image className="img-with-animation salgslederbilde skip-lazy" data-animation="fade-in" src="/demo/leangenbukta-nettside/Bilde-jef-e1602500211813-c59332.jpg" alt="" width={359} height={472} />
    </div>
    </div>
    </div>
    </div>
    <div className="wpb_text_column wpb_content_element  mont-marius">
    <p><strong>Jan Erik Fjeldseth</strong><br />
    Prosjektselger<br />
    <a href="mailto:jan.erik.fjeldseth@obos.no" target="_blank" rel="noopener noreferrer">jan.erik.fjeldseth@obos.no</a><br />
    <a href="tel:93254144">932 54 144</a></p>
    </div>
    </div>
    </div>
    </div>
    </div></div>
    </div>
    </div>
    </div>
    </div></div>
    </div></div> </div>
    </div>
    </div>
    </>
  );
}
