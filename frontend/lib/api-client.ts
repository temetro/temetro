// Thin fetch wrapper for the temetro backend's non-auth API (patients, …).
// Auth itself goes through the Better Auth client (lib/auth-client.ts).

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  // Session missing/expired — bounce to login (browser only).
  if (res.status === 401) {
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new ApiError(401, "Not authenticated.");
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const body = (await res.json().catch(() => null)) as
    | (T & { error?: string })
    | null;

  if (!res.ok) {
    throw new ApiError(
      res.status,
      body?.error ?? `Request failed with status ${res.status}.`,
    );
  }

  return body as T;
}
