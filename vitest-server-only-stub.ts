// Stub for the `server-only` package in Vitest (jsdom) test environment.
// The real `server-only` package throws at import-time in non-React-Server
// runtimes. Aliasing to this no-op lets tests that mock the importing module
// continue to run. Real enforcement is provided by the Next.js build.
export {};
