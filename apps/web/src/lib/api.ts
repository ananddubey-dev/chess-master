export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api/v1";

type ApiSuccess<T> = { success: true; data: T };

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  const body = (await response.json()) as ApiSuccess<T> | {
    success: false;
    error?: { message?: string };
  };
  if (!response.ok || !body.success) {
    const message =
      !body.success && body.error?.message
        ? body.error.message
        : `Request failed (${response.status})`;
    throw new ApiError(message, response.status);
  }
  return body.data;
}

export function socketOrigin(): string {
  return API_BASE.replace(/\/api\/v1\/?$/, "");
}
