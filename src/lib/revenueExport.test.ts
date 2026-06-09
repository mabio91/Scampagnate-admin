import { describe, expect, it } from "vitest";
import {
  buildRevenueExportRows,
  createRevenueExportXlsxBlob,
  filterRevenueRows,
  revenueRowsToCsv,
  summarizeRevenueRows,
  type RevenueEvent,
  type RevenueProfile,
  type RevenueTransaction,
} from "./revenueExport";

const profiles: RevenueProfile[] = [
  { id: "user-1", first_name: "Mario", last_name: "Rossi", email: "mario@example.com" },
];

const events: RevenueEvent[] = [
  { id: "event-1", title: "Monte Gennaro", date: "2026-06-08" },
];

const payment: RevenueTransaction = {
  id: "pay-1",
  amount: 41,
  created_at: "2026-06-08T10:00:00.000Z",
  currency: "eur",
  event_amount: 25,
  event_id: "event-1",
  kind: "payment",
  membership_fee_amount: 15,
  metadata: {},
  registration_id: "reg-1",
  service_fee_amount: 1,
  source: "event_checkout",
  stripe_checkout_session_id: "cs_123",
  stripe_payment_intent_id: "pi_123",
  stripe_refund_id: null,
  user_id: "user-1",
};

describe("revenue export", () => {
  it("splits one paid transaction into separate economic movement rows", () => {
    const rows = buildRevenueExportRows([payment], profiles, events);

    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.amount).sort((a, b) => a - b)).toEqual([1, 15, 25]);
    expect(rows.every((row) => row.transactionReference === "pi_123")).toBe(true);
    expect(rows.every((row) => row.paymentStatus === "paid")).toBe(true);
    expect(rows.find((row) => row.movementType === "membership_fee")?.movementLabel).toBe("Quota associativa");
    expect(rows.find((row) => row.movementType === "service_fee")?.movementLabel).toBe("Costo servizio");
    expect(rows.find((row) => row.movementType === "event_fee")?.movementLabel).toBe("Quota partecipazione evento");
  });

  it("exports refunds as negative rows tied to the original payment reference", () => {
    const refund: RevenueTransaction = {
      ...payment,
      id: "ref-1",
      amount: 25,
      created_at: "2026-06-10T09:00:00.000Z",
      kind: "refund",
      membership_fee_amount: 0,
      service_fee_amount: 0,
      source: "event_cancellation_refund",
      stripe_refund_id: "re_123",
    };

    const rows = buildRevenueExportRows([refund], profiles, events, [payment, refund]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      amount: -25,
      refundedAmount: 25,
      paymentDate: payment.created_at,
      refundDate: refund.created_at,
      paymentStatus: "refunded",
      transactionReference: "pi_123",
      movementLabel: "Rimborso quota partecipazione evento",
    });
  });

  it("filters and summarizes generated movement rows", () => {
    const refund: RevenueTransaction = {
      ...payment,
      id: "ref-1",
      amount: 1,
      created_at: "2026-06-10T09:00:00.000Z",
      kind: "refund",
      event_amount: 0,
      membership_fee_amount: 0,
      service_fee_amount: 1,
      source: "event_checkout_auto_refund",
      stripe_refund_id: "re_123",
    };
    const rows = buildRevenueExportRows([payment, refund], profiles, events);
    const serviceRows = filterRevenueRows(rows, { movementType: "service_fee", paymentStatus: "all", eventId: "all" });
    const summary = summarizeRevenueRows(rows);

    expect(serviceRows).toHaveLength(2);
    expect(summary.total).toBe(40);
    expect(summary.refunded).toBe(1);
    expect(summary.serviceFees).toBe(0);
  });

  it("creates a two-sheet XLSX payload and matching CSV rows", async () => {
    const rows = buildRevenueExportRows([payment], profiles, events);
    const blob = createRevenueExportXlsxBlob(rows);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const text = new TextDecoder().decode(bytes);
    const csvRows = revenueRowsToCsv(rows);

    expect(blob.type).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(String.fromCharCode(bytes[0], bytes[1])).toBe("PK");
    expect(text).toContain("Dettaglio incassi");
    expect(text).toContain("Riepilogo");
    expect(csvRows[0][0]).toBe("Data pagamento");
    expect(csvRows).toHaveLength(4);
  });
});
