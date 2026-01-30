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
  snapPoints: number[]; // [peek, half, full] in px
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
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);

  const touchStartRef = useRef<{ y: number; snap: number; time: number } | null>(null);
  const currentHeight = snapPoints[currentSnap] ?? snapPoints[0];

  // Snap to closest point
  const snapTo = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(snapPoints.length - 1, index));
      setCurrentSnap(clamped);
      setDragOffset(0);
      onSnapChange?.(clamped);
    },
    [snapPoints.length, onSnapChange]
  );

  // Touch handlers for drag handle
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      touchStartRef.current = {
        y: touch.clientY,
        snap: currentSnap,
        time: Date.now(),
      };
      setDragging(true);
    },
    [currentSnap]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStartRef.current) return;
      const touch = e.touches[0];
      const deltaY = touchStartRef.current.y - touch.clientY;
      setDragOffset(deltaY);
    },
    []
  );

  const handleTouchEnd = useCallback(() => {
    if (!touchStartRef.current) return;

    const startSnap = touchStartRef.current.snap;
    const elapsed = Date.now() - touchStartRef.current.time;
    const velocity = dragOffset / Math.max(elapsed, 1);

    // Determine target snap based on drag distance and velocity
    const threshold = 60; // px
    const velocityThreshold = 0.3; // px/ms

    let targetSnap = startSnap;

    if (dragOffset > threshold || velocity > velocityThreshold) {
      // Dragging up — go to next snap
      targetSnap = Math.min(startSnap + 1, snapPoints.length - 1);
    } else if (dragOffset < -threshold || velocity < -velocityThreshold) {
      // Dragging down — go to previous snap
      targetSnap = Math.max(startSnap - 1, 0);
    }

    snapTo(targetSnap);
    setDragging(false);
    touchStartRef.current = null;
  }, [dragOffset, snapPoints.length, snapTo]);

  // Calculate display height during drag
  const displayHeight = dragging
    ? Math.max(snapPoints[0], Math.min(snapPoints[snapPoints.length - 1], currentHeight + dragOffset))
    : currentHeight;

  // Lock body scroll when sheet is full
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

  return (
    <div
      ref={sheetRef}
      className="fixed bottom-0 left-0 right-0 z-30 bg-white rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.12)]"
      style={{
        height: displayHeight,
        transition: dragging ? "none" : "height 0.3s cubic-bezier(0.2, 0, 0, 1)",
        willChange: "height",
      }}
    >
      {/* Drag handle */}
      <div
        className="flex-shrink-0 flex items-center justify-center py-3 cursor-grab active:cursor-grabbing touch-none"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="w-10 h-1 rounded-full bg-gray-300" />
      </div>

      {/* Content */}
      <div
        ref={contentRef}
        className="flex-1 overflow-y-auto overscroll-contain"
        style={{
          height: `calc(100% - 28px)`, // subtract drag handle
        }}
      >
        {children}
      </div>
    </div>
  );
}
