"use client";

export default function ProjectError() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold">Prosjektet er midlertidig utilgjengelig</h1>
        <p className="mt-4">Vi kunne ikke laste prosjektet akkurat nå. Prøv igjen om litt.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 rounded-full bg-foreground px-6 py-3 text-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          Prøv igjen
        </button>
      </div>
    </main>
  );
}
