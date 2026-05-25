import { describe, expect, it } from "vitest";
import { normalizeImportedDate, normalizeImportedSex, parseCsvText, parsePrepaidMembershipCsv, parsePrepaidMembershipRows } from "./prepaidMembershipImport";

describe("prepaid membership CSV import", () => {
  it("parses quoted CSV fields", () => {
    expect(parseCsvText('email,nome,note\nmario@example.com,Mario,"via Roma, 12"\n')).toEqual([
      ["email", "nome", "note"],
      ["mario@example.com", "Mario", "via Roma, 12"],
    ]);
  });

  it("normalizes Italian dates to ISO format", () => {
    expect(normalizeImportedDate("03/05/1990")).toBe("1990-05-03");
    expect(normalizeImportedDate("1990-5-3")).toBe("1990-05-03");
    expect(normalizeImportedDate("5/21/26 16:33:38")).toBe("2026-05-21");
    expect(normalizeImportedDate(25569)).toBe("1970-01-01");
  });

  it("normalizes sex values to M/F", () => {
    expect(normalizeImportedSex("m")).toBe("M");
    expect(normalizeImportedSex("Femminile")).toBe("F");
    expect(normalizeImportedSex("altro")).toBeNull();
  });

  it("maps common Italian headers to prepaid membership rows", () => {
    const result = parsePrepaidMembershipCsv(
      [
        "Email,Nome,Cognome,Telefono,Sesso,Data nascita,Luogo nascita,Provincia nascita,Indirizzo residenza,Citta residenza,Provincia residenza,Data pagamento,Anno tessera",
        "LUCA@example.com,Luca,Rossi,3331234567,M,01/02/1991,Roma,rm,Via Test 1,Roma,rm,10/05/2026,2026",
      ].join("\n")
    );

    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      expect.objectContaining({
        email: "luca@example.com",
        first_name: "Luca",
        last_name: "Rossi",
        sex: "M",
        birth_date: "1991-02-01",
        province_of_birth: "RM",
        province_of_residence: "RM",
        payment_date: "2026-05-10",
        membership_year: 2026,
      }),
    ]);
  });

  it("accepts offline association rows without email", () => {
    const result = parsePrepaidMembershipCsv(
      [
        "Nome,Cognome,Sesso,Data di nascita,Luogo di Nascita,Provincia di nascita,Indirizzo di residenza (via e numero civico),Città di residenza,Provincia di residenza",
        "Luca,Rossi,M,01/02/1991,Roma,rm,Via Test 1,Roma,rm",
      ].join("\n")
    );

    expect(result.errors).toEqual([]);
    expect(result.rows[0]).toEqual(
      expect.objectContaining({
        email: null,
        first_name: "Luca",
        last_name: "Rossi",
        sex: "M",
        birth_date: "1991-02-01",
        province_of_birth: "RM",
      })
    );
  });

  it("accepts semicolon-separated CSV files from spreadsheet apps", () => {
    const result = parsePrepaidMembershipCsv(
      [
        "email;first_name;last_name;phone;sex;birth_date;birth_place;province_of_birth;residential_address;city_of_residence;province_of_residence;payment_date;membership_year;notes;",
        ";Natalia;David;;F;4/12/1996;Roma;Roma;Piazza Fonteiana n.14;Roma;Roma;5/21/26 16:33:38;2026;;",
      ].join("\n")
    );

    expect(result.errors).toEqual([]);
    expect(result.rows[0]).toEqual(
      expect.objectContaining({
        email: null,
        first_name: "Natalia",
        last_name: "David",
        sex: "F",
        birth_date: "1996-12-04",
        province_of_birth: "RM",
        province_of_residence: "RM",
        payment_date: "2026-05-21",
        membership_year: 2026,
      })
    );
  });

  it("accepts updated Excel exports with Nome2 header", () => {
    const result = parsePrepaidMembershipCsv(
      [
        "Ora di completamento,Nome2,Cognome,Sesso,Data di nascita,Luogo di Nascita,Provincia di nascita,Indirizzo di residenza (via e numero civico),Città di residenza,Provincia di residenza",
        "2026-05-18 12:16:01,Giulia,Paoletti,F,26/02/1987,Roma,rm,Piazza Test 6,Roma,rm",
      ].join("\n")
    );

    expect(result.errors).toEqual([]);
    expect(result.rows[0]).toEqual(
      expect.objectContaining({
        first_name: "Giulia",
        last_name: "Paoletti",
        sex: "F",
        birth_date: "1987-02-26",
      })
    );
  });

  it("maps Excel-style table rows from the membership form", () => {
    const result = parsePrepaidMembershipRows([
      [
        "ID",
        "Ora di completamento",
        "Nome",
        "Cognome",
        "Sesso",
        "Data di nascita",
        "Luogo di Nascita",
        "Provincia di nascita",
        "Indirizzo di residenza (via e numero civico)",
        "Città di residenza",
        "Provincia di residenza",
      ],
      [1, 46135.6, "Luca", "Rossi", "M", 25569, "Roma", "rm", "Via Test 1", "Roma", "rm"],
    ]);

    expect(result.errors).toEqual([]);
    expect(result.rows[0]).toEqual(
      expect.objectContaining({
        email: null,
        sex: "M",
        birth_date: "1970-01-01",
        source_row: expect.objectContaining({ ID: "1" }),
      })
    );
  });

  it("keeps rows with incomplete membership data but reports review errors", () => {
    const result = parsePrepaidMembershipCsv("email,nome\nanna@example.com,Anna\n");

    expect(result.rows).toHaveLength(1);
    expect(result.errors[0]).toEqual({
      row: 2,
      message:
        "Dati tesseramento incompleti: last_name, sex, birth_date, birth_place, province_of_birth, residential_address, city_of_residence, province_of_residence.",
    });
  });
});
