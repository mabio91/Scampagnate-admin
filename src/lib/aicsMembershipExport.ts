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

const XLSX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
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
  const files = createXlsxFiles(rows);
  return new Blob([createZip(files)], { type: XLSX_MIME_TYPE });
}

function createXlsxFiles(rows: string[][]) {
  return [
    { path: "[Content_Types].xml", content: contentTypesXml() },
    { path: "_rels/.rels", content: rootRelsXml() },
    { path: "docProps/app.xml", content: appXml() },
    { path: "docProps/core.xml", content: coreXml() },
    { path: "xl/workbook.xml", content: workbookXml() },
    { path: "xl/_rels/workbook.xml.rels", content: workbookRelsXml() },
    { path: "xl/styles.xml", content: stylesXml() },
    { path: "xl/worksheets/sheet1.xml", content: worksheetXml(rows) },
  ];
}

function worksheetXml(rows: string[][]) {
  const rowXml = rows
    .map((row, rowIndex) => {
      const rowNumber = rowIndex + 1;
      const cells = row
        .map((value, columnIndex) => cellXml(value, rowNumber, columnIndex + 1, rowNumber <= 2 ? rowNumber : 0))
        .filter(Boolean)
        .join("");
      return `<row r="${rowNumber}">${cells}</row>`;
    })
    .join("");

  return xmlDocument(`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><dimension ref="A1:Z${Math.max(rows.length, 2)}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="2" topLeftCell="A3" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${COLUMN_WIDTHS.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("")}</cols><sheetData>${rowXml}</sheetData><mergeCells count="${MERGED_RANGES.length}">${MERGED_RANGES.map((range) => `<mergeCell ref="${range}"/>`).join("")}</mergeCells></worksheet>`);
}

function cellXml(value: string, rowNumber: number, columnNumber: number, styleIndex: number) {
  if (!value) return "";
  const ref = `${columnName(columnNumber)}${rowNumber}`;
  const style = styleIndex ? ` s="${styleIndex}"` : "";
  return `<c r="${ref}" t="inlineStr"${style}><is><t>${escapeXml(value)}</t></is></c>`;
}

function stylesXml() {
  return xmlDocument('<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFD9EAF7"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color indexed="64"/></left><right style="thin"><color indexed="64"/></right><top style="thin"><color indexed="64"/></top><bottom style="thin"><color indexed="64"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="0"/><tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/></styleSheet>');
}

function workbookXml() {
  return xmlDocument(`<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escapeXml(SHEET_NAME)}" sheetId="1" r:id="rId1"/></sheets></workbook>`);
}

function workbookRelsXml() {
  return xmlDocument('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
}

function rootRelsXml() {
  return xmlDocument('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>');
}

function contentTypesXml() {
  return xmlDocument('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>');
}

function appXml() {
  return xmlDocument('<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Scampagnate Admin</Application></Properties>');
}

function coreXml() {
  const now = new Date().toISOString();
  return xmlDocument(`<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:creator>Scampagnate Admin</dc:creator><cp:lastModifiedBy>Scampagnate Admin</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`);
}

function xmlDocument(body: string) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${body}`;
}

function escapeXml(value: string) {
  return stripInvalidXmlCharacters(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripInvalidXmlCharacters(value: string) {
  let result = "";
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if ((code >= 0x00 && code <= 0x08) || code === 0x0b || code === 0x0c || (code >= 0x0e && code <= 0x1f)) {
      continue;
    }
    result += value[index];
  }
  return result;
}

function columnName(columnNumber: number) {
  let name = "";
  let dividend = columnNumber;
  while (dividend > 0) {
    const modulo = (dividend - 1) % 26;
    name = String.fromCharCode(65 + modulo) + name;
    dividend = Math.floor((dividend - modulo) / 26);
  }
  return name;
}

type ZipSourceFile = { path: string; content: string };

function createZip(files: ZipSourceFile[]) {
  const encoder = new TextEncoder();
  const preparedFiles = files.map((file) => ({
    ...file,
    nameBytes: encoder.encode(file.path),
    contentBytes: encoder.encode(file.content),
    offset: 0,
  }));

  const localParts: Uint8Array[] = [];
  let offset = 0;

  for (const file of preparedFiles) {
    file.offset = offset;
    const localHeader = zipLocalFileHeader(file.nameBytes, file.contentBytes);
    localParts.push(localHeader, file.contentBytes);
    offset += localHeader.length + file.contentBytes.length;
  }

  const centralParts = preparedFiles.map((file) => zipCentralDirectoryHeader(file.nameBytes, file.contentBytes, file.offset));
  const centralDirectorySize = centralParts.reduce((size, part) => size + part.length, 0);
  const endRecord = zipEndRecord(preparedFiles.length, centralDirectorySize, offset);

  return concatUint8Arrays([...localParts, ...centralParts, endRecord]);
}

function zipLocalFileHeader(nameBytes: Uint8Array, contentBytes: Uint8Array) {
  const header = new Uint8Array(30 + nameBytes.length);
  const view = new DataView(header.buffer);
  const crc = crc32(contentBytes);
  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, 0, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, 0, true);
  view.setUint32(14, crc, true);
  view.setUint32(18, contentBytes.length, true);
  view.setUint32(22, contentBytes.length, true);
  view.setUint16(26, nameBytes.length, true);
  view.setUint16(28, 0, true);
  header.set(nameBytes, 30);
  return header;
}

function zipCentralDirectoryHeader(nameBytes: Uint8Array, contentBytes: Uint8Array, localHeaderOffset: number) {
  const header = new Uint8Array(46 + nameBytes.length);
  const view = new DataView(header.buffer);
  const crc = crc32(contentBytes);
  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 20, true);
  view.setUint16(8, 0, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, 0, true);
  view.setUint16(14, 0, true);
  view.setUint32(16, crc, true);
  view.setUint32(20, contentBytes.length, true);
  view.setUint32(24, contentBytes.length, true);
  view.setUint16(28, nameBytes.length, true);
  view.setUint16(30, 0, true);
  view.setUint16(32, 0, true);
  view.setUint16(34, 0, true);
  view.setUint16(36, 0, true);
  view.setUint32(38, 0, true);
  view.setUint32(42, localHeaderOffset, true);
  header.set(nameBytes, 46);
  return header;
}

function zipEndRecord(fileCount: number, centralDirectorySize: number, centralDirectoryOffset: number) {
  const record = new Uint8Array(22);
  const view = new DataView(record.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(4, 0, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, fileCount, true);
  view.setUint16(10, fileCount, true);
  view.setUint32(12, centralDirectorySize, true);
  view.setUint32(16, centralDirectoryOffset, true);
  view.setUint16(20, 0, true);
  return record;
}

function concatUint8Arrays(parts: Uint8Array[]) {
  const totalLength = parts.reduce((length, part) => length + part.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let value = i;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[i] = value >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
