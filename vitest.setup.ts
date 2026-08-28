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

// jsdom implementerer ikke `matchMedia`. Flere komponenter spør om
// `prefers-reduced-motion` før de animerer — de skal montere i test, og
// default-svaret skal være «ingen preferanse» (altså: animer), slik at testene
// ser den samme oppførselen brukeren får. Enkelttester som trenger det motsatte
// overstyrer stubben lokalt.
if (typeof globalThis.matchMedia === "undefined") {
  globalThis.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  })) as unknown as typeof matchMedia;
}

// jsdom implementerer ikke `scrollIntoView` — det finnes ingen layout å scrolle.
// No-op-stubben lar komponenter som ruller en rad inn i syne montere og kjøre;
// at den ble kalt testes gjennom tilstanden som utløser den, ikke gjennom
// scroll-posisjonen.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}
