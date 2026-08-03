import "@testing-library/jest-dom/vitest";

// jsdom implementerer ikke ResizeObserver. Komponenter som måler sin egen
// container (nabolagssheeten måler tilgjengelig høyde for hvileposisjonene)
// ville ellers kastet ved mount. No-op-stubben lar dem montere; testene styrer
// målingen ved å stubbe clientHeight direkte.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
