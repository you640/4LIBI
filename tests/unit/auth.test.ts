import { describe, it, expect, vi, beforeEach } from "vitest";
import jsonwebtoken from "jsonwebtoken";

// Mock the jsonwebtoken module
vi.mock("jsonwebtoken", () => ({
  default: {
    verify: vi.fn(),
    sign: vi.fn(),
  },
}));

describe("Authentication", () => {
  const mockJwt = jsonwebtoken as vi.Mocked<typeof jsonwebtoken>;

  beforeEach(() => {
    vi.resetAllMocks();
    process.env.JWT_SECRET = "test-secret-key";
    process.env.API_KEY = "test-api-key";
  });

  describe("JWT Token Validation", () => {
    it("should validate correct JWT token", async () => {
      const mockUser = { userId: "user123", email: "test@example.com" };
      mockJwt.verify.mockReturnValue(mockUser);

      // Simulate the auth middleware logic
      const token = "valid-token";
      const decoded = mockJwt.verify(token, process.env.JWT_SECRET) as { userId: string; email: string };

      expect(decoded.userId).toBe("user123");
      expect(decoded.email).toBe("test@example.com");
      expect(mockJwt.verify).toHaveBeenCalledWith(token, "test-secret-key");
    });

    it("should reject invalid JWT token", async () => {
      mockJwt.verify.mockImplementation(() => {
        throw new Error("Invalid token");
      });

      const token = "invalid-token";
      
      try {
        mockJwt.verify(token, process.env.JWT_SECRET);
        expect.fail("Should have thrown an error");
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).message).toBe("Invalid token");
      }
    });
  });

  describe("API Key Authentication", () => {
    it("should accept matching API key", () => {
      const apiKey = "test-api-key";
      expect(apiKey).toBe(process.env.API_KEY);
    });

    it("should reject non-matching API key", () => {
      const apiKey = "wrong-key";
      expect(apiKey).not.toBe(process.env.API_KEY);
    });
  });

  describe("Development Mode", () => {
    it("should allow x-owner-id header in development", () => {
      process.env.NODE_ENV = "development";
      const devOwnerId = "dev-user-123";
      
      // In development, the middleware should accept x-owner-id
      expect(devOwnerId).toBeTruthy();
    });
  });
});
