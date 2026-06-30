import { afterEach, describe, expect, it, vi } from "vitest";

describe("Twenty CRM vendor", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("loads recent company and people names from GraphQL as keyterms", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        data: {
          companies: {
            edges: [
              { node: { name: " 1inch " } },
              { node: { name: "Ledger" } },
            ],
          },
          people: {
            edges: [
              { node: { name: { firstName: "Bowei", lastName: "Guang" } } },
              { node: { name: { firstName: "Ledger", lastName: "" } } },
            ],
          },
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { getTwentyCrmKeyterms } = await import("@/lib/vendors/twenty");

    await expect(
      getTwentyCrmKeyterms({
        TWENTY_API_BASE_URL: "https://crm.example.com/rest",
        TWENTY_API_KEY: "twenty-key",
      }),
    ).resolves.toEqual(["1inch", "Ledger", "Bowei Guang"]);

    const [url, init] = fetchMock.mock.calls[0];

    expect(url).toBe("https://crm.example.com/graphql");
    expect(init.headers.Authorization).toBe("Bearer twenty-key");
  });

  it("returns no keyterms when credentials are missing or CRM errors", async () => {
    const { getTwentyCrmKeyterms } = await import("@/lib/vendors/twenty");

    await expect(getTwentyCrmKeyterms({})).resolves.toEqual([]);
  });
});
