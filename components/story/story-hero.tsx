"use client";

import Image from "next/image";
import { useState } from "react";

interface StoryHeroProps {
  title: string;
  introText?: string;
  heroImages?: string[];
}

export function StoryHero({ title, introText, heroImages }: StoryHeroProps) {
  const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({});

  const handleImageError = (index: number) => {
    setImageErrors((prev) => ({ ...prev, [index]: true }));
  };

  const hasValidImages = heroImages && heroImages.length > 0;

  return (
    <section className="mb-12">
      {/* 2-kolonne bildegrid eller gradient fallback */}
      <div className="grid grid-cols-2 gap-4 mb-8 rounded-2xl overflow-hidden">
        {hasValidImages ? (
          heroImages.slice(0, 2).map((image, index) => (
            <div
              key={index}
              className="relative aspect-[4/3] bg-gray-200"
            >
              {imageErrors[index] ? (
                <div className="absolute inset-0 bg-gradient-to-br from-orange-400 to-rose-500" />
              ) : (
                <Image
                  src={image}
                  alt=""
                  fill
                  className="object-cover"
                  onError={() => handleImageError(index)}
                />
              )}
            </div>
          ))
        ) : (
          <>
            <div className="relative aspect-[4/3]">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-400 to-rose-500" />
            </div>
            <div className="relative aspect-[4/3]">
              <div className="absolute inset-0 bg-gradient-to-br from-rose-500 to-purple-500" />
            </div>
          </>
        )}
      </div>

      {/* Tittel */}
      <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
        {title}
      </h1>

      {/* Intro-tekst */}
      {introText && (
        <p className="text-lg text-gray-600 leading-relaxed">
          {introText}
        </p>
      )}
    </section>
  );
}
