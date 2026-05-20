export const FOUNDING_MEMBER_BADGE_NAME = "Founding Member";

type AssignedBadge = {
  name: string | null | undefined;
};

type MemberWithId = {
  id: string;
};

export function hasFoundingMemberBadge(badges: AssignedBadge[] | null | undefined) {
  return (badges || []).some((badge) => badge.name === FOUNDING_MEMBER_BADGE_NAME);
}

export function countMembersWithFoundingMemberBadge(
  members: MemberWithId[],
  userBadgesMap: Record<string, AssignedBadge[] | undefined>,
) {
  return members.filter((member) => hasFoundingMemberBadge(userBadgesMap[member.id])).length;
}
