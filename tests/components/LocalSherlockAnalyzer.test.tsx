import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LocalSherlockAnalyzer } from "../../src/components/sherlock/LocalSherlockAnalyzer";

describe("LocalSherlockAnalyzer", () => {
  it("nie je dôkazný režim a umožňuje lokálny upload", async () => {
    const user = userEvent.setup();
    const onAnalyze = vi.fn();
    render(<LocalSherlockAnalyzer onAnalyze={onAnalyze} error={null} />);
    expect(screen.getByText(/nie je dôkazný režim/i)).toBeInTheDocument();
    expect(document.querySelector("input[type=file]")).not.toBeNull();
    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    const file = new File(["hello"], "spis.txt", { type: "text/plain" });
    await user.upload(input, file);
    await user.click(screen.getByTestId("local-analyze-btn"));
    expect(onAnalyze).toHaveBeenCalled();
  });
});
