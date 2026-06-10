export type XlsxCellStyle = "date" | "datetime";
export type XlsxCellObject = {
  value: string | number | boolean | null | undefined;
  style?: XlsxCellStyle;
};
export type XlsxCellValue = string | number | boolean | XlsxCellObject | null | undefined;

export type XlsxWorksheet = {
  name: string;
  rows: XlsxCellValue[][];
  columnWidths?: number[];
  freezeRows?: number;
  headerRows?: number;
  mergedRanges?: string[];
};

type XlsxWorkbookOptions = {
  creator?: string;
  sheets: XlsxWorksheet[];
};

const XLSX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function createXlsxBlob({ creator = "Scampagnate Admin", sheets }: XlsxWorkbookOptions) {
  const normalizedSheets = sheets.length > 0 ? sheets : [{ name: "Foglio 1", rows: [] }];
  const files = createXlsxFiles(normalizedSheets, creator);
  return new Blob([createZip(files)], { type: XLSX_MIME_TYPE });
}

function createXlsxFiles(sheets: XlsxWorksheet[], creator: string) {
  return [
    { path: "[Content_Types].xml", content: contentTypesXml(sheets.length) },
    { path: "_rels/.rels", content: rootRelsXml() },
    { path: "docProps/app.xml", content: appXml(creator) },
    { path: "docProps/core.xml", content: coreXml(creator) },
    { path: "xl/workbook.xml", content: workbookXml(sheets) },
    { path: "xl/_rels/workbook.xml.rels", content: workbookRelsXml(sheets.length) },
    { path: "xl/styles.xml", content: stylesXml() },
    ...sheets.map((sheet, index) => ({
      path: `xl/worksheets/sheet${index + 1}.xml`,
      content: worksheetXml(sheet),
    })),
  ];
}

function worksheetXml(sheet: XlsxWorksheet) {
  const maxRows = Math.max(sheet.rows.length, 1);
  const maxColumns = Math.max(1, ...sheet.rows.map((row) => row.length), sheet.columnWidths?.length || 0);
  const rowXml = sheet.rows
    .map((row, rowIndex) => {
      const rowNumber = rowIndex + 1;
      const cells = row
        .map((value, columnIndex) => {
          const styleIndex = cellStyleIndex(rowNumber, sheet.headerRows || 0);
          return cellXml(value, rowNumber, columnIndex + 1, styleIndex);
        })
        .filter(Boolean)
        .join("");
      return `<row r="${rowNumber}">${cells}</row>`;
    })
    .join("");

  const freezeRows = sheet.freezeRows || 0;
  const paneXml = freezeRows > 0
    ? `<pane ySplit="${freezeRows}" topLeftCell="A${freezeRows + 1}" activePane="bottomLeft" state="frozen"/>`
    : "";
  const columnsXml = sheet.columnWidths?.length
    ? `<cols>${sheet.columnWidths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("")}</cols>`
    : "";
  const mergedRanges = sheet.mergedRanges || [];
  const mergeXml = mergedRanges.length
    ? `<mergeCells count="${mergedRanges.length}">${mergedRanges.map((range) => `<mergeCell ref="${range}"/>`).join("")}</mergeCells>`
    : "";

  return xmlDocument(`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><dimension ref="A1:${columnName(maxColumns)}${maxRows}"/><sheetViews><sheetView workbookViewId="0">${paneXml}</sheetView></sheetViews>${columnsXml}<sheetData>${rowXml}</sheetData>${mergeXml}</worksheet>`);
}

function cellStyleIndex(rowNumber: number, headerRows: number) {
  if (headerRows <= 0 || rowNumber > headerRows) return 0;
  return rowNumber === 1 ? 1 : 2;
}

function cellXml(value: XlsxCellValue, rowNumber: number, columnNumber: number, styleIndex: number) {
  const cell = normalizeCell(value);
  if (cell.value === null || cell.value === undefined || cell.value === "") return "";
  const ref = `${columnName(columnNumber)}${rowNumber}`;
  const resolvedStyleIndex = cell.style === "date" ? 3 : cell.style === "datetime" ? 4 : styleIndex;
  const style = resolvedStyleIndex ? ` s="${resolvedStyleIndex}"` : "";

  if (typeof cell.value === "number" && Number.isFinite(cell.value)) {
    return `<c r="${ref}"${style}><v>${cell.value}</v></c>`;
  }

  if (typeof cell.value === "boolean") {
    return `<c r="${ref}" t="b"${style}><v>${cell.value ? 1 : 0}</v></c>`;
  }

  return `<c r="${ref}" t="inlineStr"${style}><is><t>${escapeXml(String(cell.value))}</t></is></c>`;
}

function normalizeCell(value: XlsxCellValue): XlsxCellObject {
  if (isCellObject(value)) return value;
  return { value };
}

function isCellObject(value: XlsxCellValue): value is XlsxCellObject {
  return typeof value === "object" && value !== null && !Array.isArray(value) && "value" in value;
}

function stylesXml() {
  return xmlDocument('<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy hh:mm"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFD9EAF7"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color indexed="64"/></left><right style="thin"><color indexed="64"/></right><top style="thin"><color indexed="64"/></top><bottom style="thin"><color indexed="64"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="0"/><tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/></styleSheet>');
}

function workbookXml(sheets: XlsxWorksheet[]) {
  const sheetXml = sheets
    .map((sheet, index) => `<sheet name="${escapeXml(normalizeSheetName(sheet.name, index))}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`)
    .join("");
  return xmlDocument(`<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetXml}</sheets></workbook>`);
}

function workbookRelsXml(sheetCount: number) {
  const sheetRels = Array.from({ length: sheetCount }, (_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("");
  return xmlDocument(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheetRels}<Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
}

function rootRelsXml() {
  return xmlDocument('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>');
}

function contentTypesXml(sheetCount: number) {
  const sheetTypes = Array.from({ length: sheetCount }, (_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("");
  return xmlDocument(`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheetTypes}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`);
}

function appXml(application: string) {
  return xmlDocument(`<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>${escapeXml(application)}</Application></Properties>`);
}

function coreXml(creator: string) {
  const now = new Date().toISOString();
  return xmlDocument(`<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:creator>${escapeXml(creator)}</dc:creator><cp:lastModifiedBy>${escapeXml(creator)}</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`);
}

function normalizeSheetName(name: string, index: number) {
  const fallback = `Foglio ${index + 1}`;
  const cleaned = [...(name || fallback)].map((char) => "[]*?:/\\".includes(char) ? " " : char).join("").trim() || fallback;
  return cleaned.slice(0, 31);
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
