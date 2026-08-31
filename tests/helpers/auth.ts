import jwt from "jsonwebtoken";

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

export function userBearerHeaders(userId: string, email: string = `${userId}@forenzdetectiv.local`): HeadersInit {
  const secret = process.env.JWT_SECRET || "test-secret-key-min-32-characters!!";
  const token = jwt.sign({ userId, email }, secret, { expiresIn: "1h" });
  return {
    Authorization: `Bearer ${token}`,
  };
}
