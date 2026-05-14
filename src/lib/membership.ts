export function formatMembershipId(membershipId: number | null | undefined) {
  if (membershipId == null) return "—";
  return membershipId.toString().padStart(4, "0");
}
