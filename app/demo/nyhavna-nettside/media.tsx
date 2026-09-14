"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import Image from "next/image";
import { Pause, Play } from "lucide-react";

type AnimationInstance = {
  destroy(): void;
  goToAndStop(frame: number, isFrame: boolean): void;
};
type LottieWindow = Window & {
  lottie?: { loadAnimation(options: object): AnimationInstance };
};

export function Animation() {
  const container = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!ready || !container.current) return;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const animation = (window as LottieWindow).lottie?.loadAnimation({
      container: container.current,
      renderer: "svg",
      loop: true,
      autoplay: !reducedMotion,
      path: "/demo/nyhavna-nettside/nyhavna-lottie.json",
    });
    if (reducedMotion) animation?.goToAndStop(100, true);
    return () => animation?.destroy();
  }, [ready]);
  return (
    <div className="demo-animation" aria-hidden="true">
      <Image
        className="demo-symbol-fallback"
        src="/demo/nyhavna-nettside/symbol.svg"
        alt=""
        width={500}
        height={469}
        priority
      />
      <div ref={container} className="demo-lottie" />
      <Script
        src="/demo/nyhavna-nettside/lottie.min.js"
        onReady={() => setReady(true)}
      />
    </div>
  );
}

export function HarbourVideo() {
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      void video.current?.play().catch(() => {});
    }
  }, []);
  return (
    <div className="demo-video">
      <video
        ref={video}
        src="/demo/nyhavna-nettside/harbour.mp4"
        poster="/demo/nyhavna-nettside/harbour-poster.jpg"
        muted
        loop
        playsInline
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      <button
        className="demo-video-control"
        aria-label={playing ? "Sett filmen på pause" : "Spill av filmen"}
        onClick={() => {
          if (playing) video.current?.pause();
          else void video.current?.play().catch(() => {});
        }}
      >
        {playing ? <Pause size={18} /> : <Play size={18} />}
      </button>
    </div>
  );
}
