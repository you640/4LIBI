export function authHeaders(overrides: Record<string, string> = {}): HeadersInit {
  return {
    "x-api-key": process.env.API_KEY || "test-api-key-forenz",
    ...overrides,
  };
}

export function bearerHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
  };
}
