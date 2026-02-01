"use client";

import {
  useRef,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";

interface ExplorerBottomSheetProps {
  children: ReactNode;
  snapPoints: number[]; // [peek, half, full] in px from bottom
  initialSnap?: number; // index into snapPoints
  onSnapChange?: (snapIndex: number) => void;
}

export default function ExplorerBottomSheet({
  children,
  snapPoints,
  initialSnap = 0,
  onSnapChange,
}: ExplorerBottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [currentSnap, setCurrentSnap] = useState(initialSnap);
  const [translateY, setTranslateY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Track touch state
  const touchRef = useRef<{
    startY: number;
    startTranslateY: number;
    startTime: number;
    lastY: number;
    lastTime: number;
    isScrolling: boolean | null; // null = undecided, true = content scrolling, false = sheet dragging
  } | null>(null);

  const currentHeight = snapPoints[currentSnap] ?? snapPoints[0];
  const maxHeight = snapPoints[snapPoints.length - 1];
  const minHeight = snapPoints[0];

  // Snap to closest point
  const snapTo = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(snapPoints.length - 1, index));
      setCurrentSnap(clamped);
      setTranslateY(0);
      setIsDragging(false);
      onSnapChange?.(clamped);
    },
    [snapPoints.length, onSnapChange]
  );

  // Find nearest snap point given a height
  const findNearestSnap = useCallback(
    (height: number, velocity: number) => {
      const velocityThreshold = 0.4; // px/ms
      const currentIdx = currentSnap;

      // Fast fling up → go to next snap
      if (velocity > velocityThreshold && currentIdx < snapPoints.length - 1) {
        return currentIdx + 1;
      }
      // Fast fling down → go to previous snap
      if (velocity < -velocityThreshold && currentIdx > 0) {
        return currentIdx - 1;
      }

      // Otherwise, snap to closest point
      let closestIdx = 0;
      let closestDist = Infinity;
      for (let i = 0; i < snapPoints.length; i++) {
        const dist = Math.abs(snapPoints[i] - height);
        if (dist < closestDist) {
          closestDist = dist;
          closestIdx = i;
        }
      }
      return closestIdx;
    },
    [snapPoints, currentSnap]
  );

  // Handle touch start on the drag handle
  const handleHandleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      touchRef.current = {
        startY: touch.clientY,
        startTranslateY: 0,
        startTime: Date.now(),
        lastY: touch.clientY,
        lastTime: Date.now(),
        isScrolling: false, // handle always drags
      };
      setIsDragging(true);
    },
    []
  );

  // Handle touch start on content area
  const handleContentTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      touchRef.current = {
        startY: touch.clientY,
        startTranslateY: 0,
        startTime: Date.now(),
        lastY: touch.clientY,
        lastTime: Date.now(),
        isScrolling: null, // undecided
      };
    },
    []
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!touchRef.current) return;
      const touch = e.touches[0];
      const deltaY = touchRef.current.startY - touch.clientY; // positive = dragging up

      // Decide if we're scrolling content or dragging sheet
      if (touchRef.current.isScrolling === null) {
        const content = contentRef.current;
        const scrollTop = content?.scrollTop ?? 0;

        if (deltaY < 0 && scrollTop <= 0) {
          // Dragging down and content is at top → drag sheet
          touchRef.current.isScrolling = false;
          touchRef.current.startY = touch.clientY; // reset start
          setIsDragging(true);
        } else if (deltaY > 0 && currentSnap < snapPoints.length - 1) {
          // Dragging up and sheet not at max → drag sheet
          touchRef.current.isScrolling = false;
          touchRef.current.startY = touch.clientY;
          setIsDragging(true);
        } else {
          // Content scrolling
          touchRef.current.isScrolling = true;
        }
      }

      if (touchRef.current.isScrolling) return;

      // Prevent default scroll while dragging sheet
      e.preventDefault();

      // Update velocity tracking
      touchRef.current.lastY = touch.clientY;
      touchRef.current.lastTime = Date.now();

      const newDelta = touchRef.current.startY - touch.clientY;

      // Rubber-band effect at edges
      const targetHeight = currentHeight + newDelta;
      if (targetHeight > maxHeight) {
        const overflow = targetHeight - maxHeight;
        const dampened = overflow * 0.3; // rubber-band factor
        setTranslateY(newDelta - overflow + dampened);
      } else if (targetHeight < minHeight) {
        const overflow = minHeight - targetHeight;
        const dampened = overflow * 0.3;
        setTranslateY(newDelta + overflow - dampened);
      } else {
        setTranslateY(newDelta);
      }
    },
    [currentHeight, maxHeight, minHeight, currentSnap, snapPoints.length]
  );

  const handleTouchEnd = useCallback(() => {
    if (!touchRef.current || touchRef.current.isScrolling) {
      touchRef.current = null;
      return;
    }

    const elapsed = Date.now() - touchRef.current.lastTime;
    const totalDelta = touchRef.current.startY - touchRef.current.lastY;
    const velocity = elapsed > 0 ? totalDelta / Math.max(elapsed, 1) : 0; // px/ms, positive = up

    const effectiveHeight = currentHeight + translateY;
    const targetSnap = findNearestSnap(effectiveHeight, velocity);

    snapTo(targetSnap);
    touchRef.current = null;
  }, [currentHeight, translateY, findNearestSnap, snapTo]);

  // Calculate display height during drag
  const displayHeight = isDragging
    ? Math.max(minHeight * 0.7, currentHeight + translateY) // allow slight overscroll below min
    : currentHeight;

  // Lock body scroll when sheet is at full
  useEffect(() => {
    if (currentSnap === snapPoints.length - 1) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [currentSnap, snapPoints.length]);

  // Allow content scroll only when sheet is at max snap
  const contentOverflow = currentSnap === snapPoints.length - 1 && !isDragging
    ? "auto"
    : "hidden";

  return (
    <>
      {/* Backdrop dim at full height */}
      <div
        className="fixed inset-0 bg-black/20 z-20 pointer-events-none transition-opacity duration-300"
        style={{
          opacity: currentSnap === snapPoints.length - 1 && !isDragging ? 1 : 0,
        }}
      />

      <div
        ref={sheetRef}
        className="fixed bottom-0 left-0 right-0 z-30 bg-white rounded-t-2xl shadow-[0_-4px_24px_rgba(0,0,0,0.1)] flex flex-col"
        style={{
          height: displayHeight,
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          transition: isDragging ? "none" : "height 0.35s cubic-bezier(0.25, 1, 0.5, 1)",
          willChange: isDragging ? "height" : "auto",
        }}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag handle */}
        <div
          className="flex-shrink-0 flex items-center justify-center pt-2.5 pb-2 cursor-grab active:cursor-grabbing touch-none select-none"
          onTouchStart={handleHandleTouchStart}
        >
          <div className="w-9 h-[5px] rounded-full bg-gray-300" />
        </div>

        {/* Content */}
        <div
          ref={contentRef}
          className="flex-1 min-h-0 flex flex-col"
          style={{
            overflowY: contentOverflow,
            overflowX: "hidden",
            WebkitOverflowScrolling: "touch",
          }}
          onTouchStart={handleContentTouchStart}
        >
          {children}
        </div>
      </div>
    </>
  );
}
