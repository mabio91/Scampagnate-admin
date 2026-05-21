export type PrepaidMembershipImportRow = {
  email: string | null;
  first_name: string;
  last_name: string;
  phone: string | null;
  birth_date: string | null;
  birth_place: string | null;
  province_of_birth: string | null;
  residential_address: string | null;
  city_of_residence: string | null;
  province_of_residence: string | null;
  payment_date: string | null;
  membership_year: number | null;
  notes: string | null;
  source_row: Record<string, string>;
};

type ImportedCell = string | number | boolean | Date | null | undefined;

export type PrepaidMembershipImportError = {
  row: number;
  message: string;
};

export type PrepaidMembershipImportParseResult = {
  rows: PrepaidMembershipImportRow[];
  errors: PrepaidMembershipImportError[];
};

const headerMap: Record<string, keyof PrepaidMembershipImportRow> = {
  email: "email",
  e_mail: "email",
  mail: "email",
  nome: "first_name",
  nome2: "first_name",
  name: "first_name",
  first_name: "first_name",
  firstname: "first_name",
  cognome: "last_name",
  surname: "last_name",
  last_name: "last_name",
  lastname: "last_name",
  telefono: "phone",
  cellulare: "phone",
  phone: "phone",
  data_nascita: "birth_date",
  data_di_nascita: "birth_date",
  datadinascita: "birth_date",
  birth_date: "birth_date",
  date_of_birth: "birth_date",
  luogo_nascita: "birth_place",
  luogo_di_nascita: "birth_place",
  luogodinascita: "birth_place",
  birth_place: "birth_place",
  provincia_nascita: "province_of_birth",
  provincia_di_nascita: "province_of_birth",
  prov_nascita: "province_of_birth",
  province_of_birth: "province_of_birth",
  indirizzo_residenza: "residential_address",
  indirizzo_di_residenza: "residential_address",
  indirizzo_di_residenza_via_e_numero_civico: "residential_address",
  indirizzodiresidenza: "residential_address",
  residential_address: "residential_address",
  address: "residential_address",
  citta_residenza: "city_of_residence",
  citta_di_residenza: "city_of_residence",
  city_of_residence: "city_of_residence",
  city: "city_of_residence",
  provincia_residenza: "province_of_residence",
  provincia_di_residenza: "province_of_residence",
  prov_residenza: "province_of_residence",
  province_of_residence: "province_of_residence",
  data_pagamento: "payment_date",
  payment_date: "payment_date",
  paid_at: "payment_date",
  anno: "membership_year",
  anno_tessera: "membership_year",
  membership_year: "membership_year",
  note: "notes",
  notes: "notes",
};

const requiredMembershipFields: Array<keyof PrepaidMembershipImportRow> = [
  "first_name",
  "last_name",
  "birth_date",
  "birth_place",
  "province_of_birth",
  "residential_address",
  "city_of_residence",
  "province_of_residence",
];

const emptyRow = (): PrepaidMembershipImportRow => ({
  email: null,
  first_name: "",
  last_name: "",
  phone: null,
  birth_date: null,
  birth_place: null,
  province_of_birth: null,
  residential_address: null,
  city_of_residence: null,
  province_of_residence: null,
  payment_date: null,
  membership_year: null,
  notes: null,
  source_row: {},
});

const normalizeHeader = (value: string) =>
  value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const stringifyCell = (value: ImportedCell) => {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
};

const normalizeText = (value: ImportedCell) => {
  const trimmed = stringifyCell(value).trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeProvince = (value: ImportedCell) => {
  const normalized = normalizeText(value);
  return normalized ? normalized.toUpperCase() : null;
};

export const normalizeImportedEmail = (value: ImportedCell) => {
  const normalized = normalizeText(value);
  return normalized ? normalized.toLowerCase() : null;
};

const excelSerialDateToIso = (value: number) => {
  if (!Number.isFinite(value) || value < 1) return null;
  const utc = Date.UTC(1899, 11, 30) + Math.floor(value) * 24 * 60 * 60 * 1000;
  const date = new Date(utc);
  return date.toISOString().slice(0, 10);
};

export const normalizeImportedDate = (value: ImportedCell) => {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number") return excelSerialDateToIso(value);

  const trimmed = normalizeText(value);
  if (!trimmed) return null;

  const iso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const [, year, month, day] = iso;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const italian = trimmed.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (italian) {
    const [, day, month, year] = italian;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  return null;
};

const parseMembershipYear = (value: ImportedCell) => {
  const normalized = normalizeText(value);
  if (!normalized || !/^\d{4}$/.test(normalized)) return null;
  const year = Number(normalized);
  return year >= 2020 && year <= 2100 ? year : null;
};

export const parseCsvText = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field);
      if (row.some((cell) => cell.trim().length > 0)) rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  row.push(field);
  if (row.some((cell) => cell.trim().length > 0)) rows.push(row);
  return rows;
};

export const parsePrepaidMembershipRows = (importRows: ImportedCell[][]): PrepaidMembershipImportParseResult => {
  const errors: PrepaidMembershipImportError[] = [];
  const rows: PrepaidMembershipImportRow[] = [];

  if (importRows.length === 0) {
    return { rows, errors: [{ row: 0, message: "Il file e vuoto." }] };
  }

  const headers = importRows[0].map((cell) => normalizeHeader(stringifyCell(cell)));
  const mappedHeaders = headers.map((header) => headerMap[header] || null);

  importRows.slice(1).forEach((cells, rowIndex) => {
    const displayRow = rowIndex + 2;
    const parsed = emptyRow();
    const sourceRow: Record<string, string> = {};

    cells.forEach((cell, cellIndex) => {
      const rawHeader = stringifyCell(importRows[0][cellIndex]).trim() || `column_${cellIndex + 1}`;
      const target = mappedHeaders[cellIndex];
      sourceRow[rawHeader] = stringifyCell(cell).trim();
      if (!target || target === "source_row") return;

      if (target === "email") parsed.email = normalizeImportedEmail(cell);
      else if (target === "birth_date") parsed.birth_date = normalizeImportedDate(cell);
      else if (target === "payment_date") parsed.payment_date = normalizeImportedDate(cell);
      else if (target === "membership_year") parsed.membership_year = parseMembershipYear(cell);
      else if (target === "province_of_birth" || target === "province_of_residence") parsed[target] = normalizeProvince(cell);
      else if (target === "first_name" || target === "last_name") parsed[target] = normalizeText(cell) || "";
      else if (target === "phone" || target === "birth_place" || target === "residential_address" || target === "city_of_residence" || target === "notes") {
        parsed[target] = normalizeText(cell);
      }
    });

    parsed.source_row = sourceRow;
    const missing = requiredMembershipFields.filter((fieldName) => !parsed[fieldName]);
    if (missing.length > 0) {
      errors.push({
        row: displayRow,
        message: `Dati tesseramento incompleti: ${missing.join(", ")}.`,
      });
    }
    if (!parsed.email && (!parsed.first_name || !parsed.last_name || !parsed.birth_date)) {
      errors.push({
        row: displayRow,
        message: "Senza email servono almeno nome, cognome e data di nascita per il matching automatico.",
      });
    }

    rows.push(parsed);
  });

  return { rows, errors };
};

export const parsePrepaidMembershipCsv = (text: string): PrepaidMembershipImportParseResult =>
  parsePrepaidMembershipRows(parseCsvText(text));
