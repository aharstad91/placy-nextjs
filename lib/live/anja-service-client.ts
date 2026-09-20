import "server-only";

const baseUrl = () => {
  const value = process.env.ANJA_SERVICE_URL;
  if (!value) throw new Error("ANJA_SERVICE_URL mangler.");
  return value.replace(/\/$/, "");
};

const serviceSecret = () => {
  const value = process.env.ANJA_SERVICE_SECRET;
  if (!value) throw new Error("ANJA_SERVICE_SECRET mangler.");
  return value;
};

export async function callAnjaService(
  path: string,
  init: RequestInit = {},
  session?: string,
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${serviceSecret()}`);
  if (session) headers.set("X-Anja-Session", session);
  return fetch(`${baseUrl()}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
}
