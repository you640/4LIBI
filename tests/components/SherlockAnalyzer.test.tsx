import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SherlockAnalyzer } from "../../src/components/sherlock/SherlockAnalyzer";

describe("SherlockAnalyzer", () => {
  it("shows upload CTA and error", () => {
    render(
      <SherlockAnalyzer onAnalyze={vi.fn()} error="Chyba analýzy" />
    );
    expect(screen.getByText(/Pretiahnite PDF/i)).toBeInTheDocument();
    expect(screen.getByText(/Chyba analýzy/i)).toBeInTheDocument();
  });

  it("enables analyze after file select", async () => {
    const user = userEvent.setup();
    const onAnalyze = vi.fn();
    render(<SherlockAnalyzer onAnalyze={onAnalyze} error={null} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["hello"], "spis.txt", { type: "text/plain" });
    await user.upload(input, file);
    expect(screen.getByText("spis.txt")).toBeInTheDocument();
        const button = screen.getByRole("button", { name: /Spustiť Sherlock analýzu/i });
    await user.click(button);
    expect(onAnalyze).toHaveBeenCalled();
  });
});
