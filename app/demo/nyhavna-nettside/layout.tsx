import type { Metadata } from "next";
import localFont from "next/font/local";
import { Header } from "@/app/demo/nyhavna-nettside/header";
import "@/app/demo/nyhavna-nettside/original.css";
import "@/app/demo/nyhavna-nettside/demo.css";

const unbounded = localFont({
  src: [
    {
      path: "../../../public/demo/nyhavna-nettside/unbounded-400.ttf",
      weight: "400",
    },
    {
      path: "../../../public/demo/nyhavna-nettside/unbounded-600.ttf",
      weight: "600",
    },
    {
      path: "../../../public/demo/nyhavna-nettside/unbounded-700.ttf",
      weight: "700",
    },
  ],
  variable: "--font-nyhavna",
  display: "swap",
});

export const metadata: Metadata = {
  icons: { icon: "/demo/nyhavna-nettside/symbol.svg" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`nyhavna-site ${unbounded.variable}`}>
      <a className="demo-skip" href="#main-content">
        Gå til hovedinnholdet
      </a>
      <Header />
      {children}
      <footer className="demo-footer site-width">
        <a className="demo-wordmark" href="/demo/nyhavna-nettside">
          Nyhavna
        </a>
        <p>
          Kobbes gt. 2, 6. etg
          <br />
          7042 Trondheim
          <br />
          <a href="mailto:post@nyhavna.no">post@nyhavna.no</a>
        </p>
        <nav aria-label="Bunnmeny">
          <a href="https://nyhavna.no/om-selskapet/">Om selskapet</a>
          <a href="https://nyhavna.no/om-selskapet/baerekraft/">Bærekraft</a>
          <a href="https://nyhavna.no/personvern/">Personvern</a>
        </nav>
      </footer>
    </div>
  );
}
