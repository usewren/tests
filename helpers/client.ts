// Shared test client helpers

export const BASE = process.env.WREN_URL ?? "http://localhost:4000";

export async function request(
  method: string,
  path: string,
  body?: unknown,
  cookie?: string,
): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Origin": BASE,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

export const get  = (path: string, cookie?: string) => request("GET",    path, undefined, cookie);
export const post = (path: string, body: unknown, cookie?: string) => request("POST",   path, body, cookie);
export const put  = (path: string, body: unknown, cookie?: string) => request("PUT",    path, body, cookie);
export const del  = (path: string, cookie?: string) => request("DELETE", path, undefined, cookie);

/** Sign up a fresh user and return the session cookie. */
export async function signUp(): Promise<string> {
  const email = `test+${Date.now()}-${Math.random().toString(36).slice(2)}@wren.dev`;
  const res = await post("/api/auth/sign-up/email", {
    email,
    password: "testpassword123",
    name: "Test User",
  });
  if (!res.ok) throw new Error(`Sign-up failed: ${res.status}`);
  const raw = res.headers.get("set-cookie") ?? "";
  return decodeURIComponent(raw.split(";")[0]);
}

export async function json<T = unknown>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}
