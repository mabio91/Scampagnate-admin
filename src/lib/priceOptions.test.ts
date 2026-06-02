import { describe, expect, it } from "vitest";
import { getPriceOptionDisplayName } from "@/lib/priceOptions";

describe("price option display names", () => {
  it("hides empty and generated formula names", () => {
    expect(getPriceOptionDisplayName({ name: null })).toBe("Partecipazione evento");
    expect(getPriceOptionDisplayName({ name: "" })).toBe("Partecipazione evento");
    expect(getPriceOptionDisplayName({ name: "Formula 1" })).toBe("Partecipazione evento");
  });

  it("keeps organizer-provided formula names", () => {
    expect(getPriceOptionDisplayName({ name: "Quota soci" })).toBe("Quota soci");
    expect(getPriceOptionDisplayName({ name: "Formula famiglia" })).toBe("Formula famiglia");
  });
});
