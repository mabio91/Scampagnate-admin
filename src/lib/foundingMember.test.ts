import { describe, expect, it } from "vitest";
import { FOUNDING_MEMBER_BADGE_NAME, countMembersWithFoundingMemberBadge, hasFoundingMemberBadge } from "./foundingMember";

describe("founding member badge helpers", () => {
  it("recognizes only the assigned Founding Member badge", () => {
    expect(hasFoundingMemberBadge([{ name: FOUNDING_MEMBER_BADGE_NAME }])).toBe(true);
    expect(hasFoundingMemberBadge([{ name: "Trail Expert" }])).toBe(false);
    expect(hasFoundingMemberBadge([])).toBe(false);
  });

  it("counts members from badge assignments instead of profile flags", () => {
    const members = [
      { id: "member-with-badge", is_founding_member: false },
      { id: "member-only-flagged", is_founding_member: true },
      { id: "member-with-other-badge", is_founding_member: false },
    ];

    const userBadgesMap = {
      "member-with-badge": [{ name: FOUNDING_MEMBER_BADGE_NAME }],
      "member-only-flagged": [],
      "member-with-other-badge": [{ name: "Trail Expert" }],
    };

    expect(countMembersWithFoundingMemberBadge(members, userBadgesMap)).toBe(1);
  });

  it("does not count badge assignments for users outside the members list", () => {
    const members = [{ id: "listed-member" }];
    const userBadgesMap = {
      "listed-member": [],
      "other-user": [{ name: FOUNDING_MEMBER_BADGE_NAME }],
    };

    expect(countMembersWithFoundingMemberBadge(members, userBadgesMap)).toBe(0);
  });
});
