import { createXlsxBlob } from "./simpleXlsx";

export type AicsMembershipExportMember = {
  first_name: string | null;
  last_name: string | null;
  sex?: string | null;
  birth_date?: string | null;
  province_of_birth?: string | null;
  birth_place?: string | null;
  residential_address?: string | null;
  province_of_residence?: string | null;
  city_of_residence?: string | null;
  phone?: string | null;
  email?: string | null;
};

const SHEET_NAME = "Modello importazione soci";
const DEFAULT_SOCIAL_QUALIFICATION = "atleta";
const DEFAULT_SPORT_QUALIFICATION = "Atleta praticante";
const DEFAULT_SPORT_ACTIVITY_CODE = "S0320";

const GROUP_ROW = [
  "NOMINATIVO",
  "",
  "DATI DI NASCITA",
  "",
  "",
  "",
  "",
  "DATI DI RESIDENZA / DOMICILIO",
  "",
  "",
  "",
  "RECAPITI ABITAZIONE",
  "",
  "RECAPITI UFFICIO",
  "",
  "ALTRI RECAPITI",
  "",
  "INQUADRAMENTO SOCIALE",
  "",
  "INQUADRAMENTO SPORTIVO",
  "",
  "CERTIFICATO MEDICO",
  "",
  "",
  "TESSERA",
  "",
];

const HEADER_ROW = [
  "COGNOME",
  "NOME",
  "SESSO",
  "DATA",
  "PROVINCIA",
  "COMUNE",
  "CODICE FISCALE",
  "INDIRIZZO",
  "CAP",
  "PROVINCIA",
  "COMUNE",
  "TELEFONO",
  "FAX",
  "TELEFONO",
  "FAX",
  "CELLULARE",
  "EMAIL",
  "QUALIFICA",
  "ATTIVITÀ",
  "QUALIFICA",
  "ATTIVITÀ",
  "TIPO",
  "DATA RILASCIO",
  "DATA SCADENZA",
  "NUMERO",
  "DATA RILASCIO",
];

const COLUMN_WIDTHS = [
  20.77734375,
  20.77734375,
  6.77734375,
  10.77734375,
  13,
  30.77734375,
  20.77734375,
  30.77734375,
  6.77734375,
  10.77734375,
  30.77734375,
  15.77734375,
  15.77734375,
  15.77734375,
  15.77734375,
  15.77734375,
  30.77734375,
  15.77734375,
  15.77734375,
  15.77734375,
  15.77734375,
  8.77734375,
  15.77734375,
  15.77734375,
  8.77734375,
  15.77734375,
];

const MERGED_RANGES = [
  "A1:B1",
  "C1:G1",
  "H1:K1",
  "L1:M1",
  "N1:O1",
  "P1:Q1",
  "R1:S1",
  "T1:U1",
  "V1:X1",
  "Y1:Z1",
];

const safeText = (value: string | number | null | undefined) => String(value ?? "").trim();

export const formatAicsDate = (value: string | null | undefined) => {
  const text = safeText(value);
  if (!text) return "";

  const isoDate = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDate) return `${isoDate[3]}/${isoDate[2]}/${isoDate[1]}`;

  return text;
};

export const normalizeAicsProvince = (value: string | null | undefined) => safeText(value).toUpperCase();

export const normalizeAicsSex = (value: string | null | undefined) => {
  const sex = safeText(value).toUpperCase();
  return sex === "M" || sex === "F" ? sex : "";
};

export const normalizeAicsPhone = (value: string | null | undefined) => safeText(value).replace(/\D/g, "");

export const buildAicsMembershipRows = (members: AicsMembershipExportMember[]) => [
  GROUP_ROW,
  HEADER_ROW,
  ...members.map((member) => [
    safeText(member.last_name),
    safeText(member.first_name),
    normalizeAicsSex(member.sex),
    formatAicsDate(member.birth_date),
    normalizeAicsProvince(member.province_of_birth),
    safeText(member.birth_place),
    "",
    safeText(member.residential_address),
    "",
    normalizeAicsProvince(member.province_of_residence),
    safeText(member.city_of_residence),
    "",
    "",
    "",
    "",
    normalizeAicsPhone(member.phone),
    safeText(member.email),
    DEFAULT_SOCIAL_QUALIFICATION,
    "",
    DEFAULT_SPORT_QUALIFICATION,
    DEFAULT_SPORT_ACTIVITY_CODE,
    "",
    "",
    "",
    "",
    "",
    "",
  ]),
];

export function exportAicsMembershipXlsx(filename: string, members: AicsMembershipExportMember[]) {
  const rows = buildAicsMembershipRows(members);
  const blob = createAicsMembershipXlsxBlob(rows);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}_${new Date().toISOString().split("T")[0]}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}

export function createAicsMembershipXlsxBlob(rows: string[][]) {
  return createXlsxBlob({
    creator: "Scampagnate Admin",
    sheets: [
      {
        name: SHEET_NAME,
        rows,
        columnWidths: COLUMN_WIDTHS,
        freezeRows: 2,
        headerRows: 2,
        mergedRanges: MERGED_RANGES,
      },
    ],
  });
}
