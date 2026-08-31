import { describe, expect, it } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HomePage } from "../../src/pages/HomePage";

function renderHome(initial = "/") {
  const router = createMemoryRouter(
    [
      { path: "/", element: <HomePage /> },
      {
        path: "/sherlock",
        element: <div data-testid="sherlock-dest">Sherlock</div>,
      },
    ],
    { initialEntries: [initial] }
  );
  return render(<RouterProvider router={router} />);
}

describe("HomePage landing", () => {
  it("ukáže kinematický rozpor a tri otázky, nie demo CTA", () => {
    renderHome();
    expect(screen.getByTestId("home-hero")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      /Devätnásť minút/
    );
    expect(screen.getByText("290 km/h")).toBeInTheDocument();
    expect(screen.getByText(/weapons_flow/)).toBeInTheDocument();
    expect(screen.getByTestId("home-proof-strip")).toHaveTextContent("Rozpory");
    expect(screen.queryByTestId("home-cta-demo")).not.toBeInTheDocument();
  });

  it("CTA vedie na Sherlock", async () => {
    renderHome();
    await userEvent.click(screen.getByTestId("home-cta-upload"));
    expect(screen.getByTestId("sherlock-dest")).toBeInTheDocument();
  });
});
