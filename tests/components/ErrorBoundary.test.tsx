import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ErrorBoundary } from "../../src/components/ErrorBoundary";

vi.mock("@sentry/react", () => ({
  captureException: vi.fn(() => "evt_1"),
}));

function Boom(): never {
  throw new Error("boom-test");
}

describe("ErrorBoundary", () => {
  it("renders children when healthy", () => {
    render(
      <ErrorBoundary>
        <div>OK content</div>
      </ErrorBoundary>
    );
    expect(screen.getByText("OK content")).toBeInTheDocument();
  });

  it("shows fallback UI on render error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );
    expect(screen.getByText(/Niečo sa pokazilo/i)).toBeInTheDocument();
    spy.mockRestore();
  });
});
