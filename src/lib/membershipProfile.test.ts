import { describe, expect, it } from "vitest";
import {
  formatMembershipDateValue,
  getMembershipCompleteness,
  hasActiveMembership,
  isValidMembershipSex,
} from "./membershipProfile";

describe("membership profile completeness", () => {
  it("marks a profile complete when every AICS field is present", () => {
    const result = getMembershipCompleteness({
      first_name: "Mario",
      last_name: "Rossi",
      sex: "m",
      birth_date: "1983-04-15",
      birth_place: "Milano",
      province_of_birth: "MI",
      residential_address: "Via Roma 1",
      city_of_residence: "Monza",
      province_of_residence: "MB",
      phone: "+39 333 123 4567",
      email: "mario@example.com",
    });

    expect(result.isComplete).toBe(true);
    expect(result.percentage).toBe(100);
    expect(result.missingFields).toHaveLength(0);
  });

  it("returns missing labels for invalid or empty membership fields", () => {
    const result = getMembershipCompleteness({
      first_name: "Mario",
      last_name: "Rossi",
      sex: "altro",
      birth_date: "1983-04-15",
      birth_place: "",
      province_of_birth: "MI",
      residential_address: "—",
      city_of_residence: "Monza",
      province_of_residence: "MB",
      phone: "",
      email: "mario@example.com",
    });

    expect(result.isComplete).toBe(false);
    expect(result.missingFields.map((field) => field.key)).toEqual([
      "sex",
      "birth_place",
      "residential_address",
      "phone",
    ]);
  });

  it("normalizes sex and dates for display", () => {
    expect(isValidMembershipSex("f")).toBe(true);
    expect(isValidMembershipSex("female")).toBe(false);
    expect(formatMembershipDateValue("2000-01-02")).toBe("02/01/2000");
  });

  it("detects active current-year memberships", () => {
    expect(hasActiveMembership({ membership_status: "Active", membership_year: 2026 }, 2026)).toBe(true);
    expect(hasActiveMembership({ membership_status: "Active", membership_year: 2025 }, 2026)).toBe(false);
    expect(hasActiveMembership({ membership_status: "Expired", membership_year: 2026 }, 2026)).toBe(false);
  });
});
