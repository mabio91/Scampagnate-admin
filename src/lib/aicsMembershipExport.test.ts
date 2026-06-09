import { describe, expect, it } from "vitest";
import {
  buildAicsMembershipRows,
  createAicsMembershipXlsxBlob,
  formatAicsDate,
  normalizeAicsPhone,
} from "./aicsMembershipExport";

describe("AICS membership export", () => {
  it("maps members to the AICS template columns", () => {
    const rows = buildAicsMembershipRows([
      {
        first_name: "Mario",
        last_name: "Rossi",
        sex: "m",
        birth_date: "1983-04-15",
        province_of_birth: "mi",
        birth_place: "Milano",
        residential_address: "Via Roma 1",
        province_of_residence: "mb",
        city_of_residence: "Monza",
        phone: "+39 333 123 4567",
        email: "mario@example.com",
      },
    ]);

    expect(rows[1]).toHaveLength(26);
    expect(rows[1][18]).toBe("ATTIVITÀ");
    expect(rows[2]).toEqual([
      "Rossi",
      "Mario",
      "M",
      "15/04/1983",
      "MI",
      "Milano",
      "",
      "Via Roma 1",
      "",
      "MB",
      "Monza",
      "",
      "",
      "",
      "",
      "393331234567",
      "mario@example.com",
      "atleta",
      "",
      "Atleta praticante",
      "S0320",
      "",
      "",
      "",
      "",
      "",
      "",
    ]);
  });

  it("normalizes date and phone values for the import format", () => {
    expect(formatAicsDate("2000-01-02")).toBe("02/01/2000");
    expect(formatAicsDate("02/01/2000")).toBe("02/01/2000");
    expect(normalizeAicsPhone("+39 333 123 4567")).toBe("393331234567");
  });

  it("creates a real XLSX zip payload", async () => {
    const blob = createAicsMembershipXlsxBlob(buildAicsMembershipRows([]));
    const bytes = new Uint8Array(await blob.arrayBuffer());

    expect(blob.type).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(String.fromCharCode(bytes[0], bytes[1])).toBe("PK");
  });

  it("orders worksheet XML nodes in the sequence required by Excel", async () => {
    const blob = createAicsMembershipXlsxBlob(buildAicsMembershipRows([]));
    const xlsxText = new TextDecoder().decode(await blob.arrayBuffer());
    const worksheetStart = xlsxText.indexOf("<worksheet");
    const dimensionIndex = xlsxText.indexOf("<dimension", worksheetStart);
    const sheetViewsIndex = xlsxText.indexOf("<sheetViews", worksheetStart);
    const columnsIndex = xlsxText.indexOf("<cols>", worksheetStart);
    const sheetDataIndex = xlsxText.indexOf("<sheetData>", worksheetStart);
    const mergeCellsIndex = xlsxText.indexOf("<mergeCells", worksheetStart);

    expect(worksheetStart).toBeGreaterThan(-1);
    expect(dimensionIndex).toBeGreaterThan(worksheetStart);
    expect(sheetViewsIndex).toBeGreaterThan(dimensionIndex);
    expect(columnsIndex).toBeGreaterThan(sheetViewsIndex);
    expect(sheetDataIndex).toBeGreaterThan(columnsIndex);
    expect(mergeCellsIndex).toBeGreaterThan(sheetDataIndex);
  });
});
