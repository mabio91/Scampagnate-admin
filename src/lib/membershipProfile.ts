export type MembershipProfileData = {
  first_name?: string | null;
  last_name?: string | null;
  sex?: string | null;
  birth_date?: string | null;
  birth_place?: string | null;
  province_of_birth?: string | null;
  residential_address?: string | null;
  city_of_residence?: string | null;
  province_of_residence?: string | null;
  phone?: string | null;
  email?: string | null;
  membership_id?: number | null;
  membership_status?: string | null;
  membership_year?: number | null;
};

export type MembershipDataFieldKey =
  | "first_name"
  | "last_name"
  | "sex"
  | "birth_date"
  | "birth_place"
  | "province_of_birth"
  | "residential_address"
  | "city_of_residence"
  | "province_of_residence"
  | "phone"
  | "email";

export type MembershipDataField = {
  key: MembershipDataFieldKey;
  label: string;
  value: string;
  displayValue: string;
  complete: boolean;
};

export const membershipDataFieldLabels: Record<MembershipDataFieldKey, string> = {
  first_name: "Nome",
  last_name: "Cognome",
  sex: "Sesso anagrafico",
  birth_date: "Data di nascita",
  birth_place: "Comune/Stato di nascita",
  province_of_birth: "Provincia nascita",
  residential_address: "Indirizzo residenza",
  city_of_residence: "Comune residenza",
  province_of_residence: "Provincia residenza",
  phone: "Cellulare",
  email: "Email",
};

export const requiredMembershipDataFields: MembershipDataFieldKey[] = [
  "first_name",
  "last_name",
  "sex",
  "birth_date",
  "birth_place",
  "province_of_birth",
  "residential_address",
  "city_of_residence",
  "province_of_residence",
  "phone",
  "email",
];

const emptyTokens = new Set(["", "-", "—"]);

export const normalizeMembershipText = (value: unknown) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

export const hasMembershipValue = (value: unknown) => {
  const normalized = normalizeMembershipText(value);
  return !emptyTokens.has(normalized);
};

export const isValidMembershipSex = (value: unknown) => {
  const normalized = normalizeMembershipText(value).toUpperCase();
  return normalized === "M" || normalized === "F";
};

export const formatMembershipDateValue = (value: unknown) => {
  const normalized = normalizeMembershipText(value);
  if (!normalized) return "—";

  const isoDate = normalized.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDate) return `${isoDate[3]}/${isoDate[2]}/${isoDate[1]}`;

  return normalized;
};

export const formatMembershipFieldValue = (key: MembershipDataFieldKey, value: unknown) => {
  if (!hasMembershipValue(value)) return "—";
  if (key === "birth_date") return formatMembershipDateValue(value);
  if (key === "sex") return normalizeMembershipText(value).toUpperCase();
  return normalizeMembershipText(value);
};

export function getMembershipDataFields(profile: MembershipProfileData): MembershipDataField[] {
  return requiredMembershipDataFields.map((key) => {
    const value = normalizeMembershipText(profile[key]);
    const complete = key === "sex" ? isValidMembershipSex(value) : hasMembershipValue(value);

    return {
      key,
      label: membershipDataFieldLabels[key],
      value,
      displayValue: formatMembershipFieldValue(key, value),
      complete,
    };
  });
}

export function getMembershipCompleteness(profile: MembershipProfileData) {
  const fields = getMembershipDataFields(profile);
  const missingFields = fields.filter((field) => !field.complete);
  const completedCount = fields.length - missingFields.length;
  const percentage = fields.length > 0 ? Math.round((completedCount / fields.length) * 100) : 100;

  return {
    fields,
    missingFields,
    completedCount,
    totalCount: fields.length,
    percentage,
    isComplete: missingFields.length === 0,
  };
}

export function getMembershipDisplayName(profile: MembershipProfileData) {
  const name = `${normalizeMembershipText(profile.first_name)} ${normalizeMembershipText(profile.last_name)}`.trim();
  return name || "Utente senza nome";
}

export function hasActiveMembership(profile: MembershipProfileData, year = new Date().getFullYear()) {
  return profile.membership_status === "Active" && (profile.membership_year == null || profile.membership_year === year);
}

export function getMembershipStatusLabel(status: string | null | undefined) {
  if (status === "Active") return "Attiva";
  if (status === "Expired") return "Scaduta";
  if (status === "Pending") return "In attesa";
  if (status === "Inactive") return "Inattiva";
  return "Non impostata";
}
