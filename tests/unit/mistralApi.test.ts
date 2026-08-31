import { describe, it, expect, vi, beforeEach } from "vitest";
import { callMistralApi } from "../../src/lib/mistralApi";

describe("mistralApi", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch");
  });

  it("returns content on success", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '{"ok":true}' } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    const text = await callMistralApi(
      [{ role: "user", content: "hi" }],
      { apiKey: "k" }
    );
    expect(text).toContain("ok");
  });

  it("throws when api key missing", async () => {
    await expect(
      callMistralApi([{ role: "user", content: "hi" }], { apiKey: "" })
    ).rejects.toThrow(/MISTRAL_API_KEY/);
  });

  it("throws on non-retryable error", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "bad" }), { status: 400 })
    );
    await expect(
      callMistralApi([{ role: "user", content: "hi" }], { apiKey: "k" })
    ).rejects.toThrow(/Mistral API chyba/);
  });

  it("sends json_schema structured output when schema is provided", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '{"ok":true}' } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    await callMistralApi([{ role: "user", content: "hi" }], {
      apiKey: "k",
      jsonSchema: {
        name: "forensic_analysis",
        schema: { type: "object" },
        strict: true,
      },
    });
    const body = JSON.parse(
      vi.mocked(fetch).mock.calls[0][1]?.body as string
    ) as { response_format: Record<string, unknown> };
    expect(body.response_format).toMatchObject({
      type: "json_schema",
      json_schema: {
        name: "forensic_analysis",
        strict: true,
      },
    });
  });
});
