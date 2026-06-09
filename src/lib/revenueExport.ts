import { createXlsxBlob, type XlsxCellValue } from "./simpleXlsx";

export type RevenueMovementType = "membership_fee" | "event_fee" | "service_fee" | "unclassified";
export type RevenuePaymentStatus = "paid" | "refunded" | "cancelled";
export type RevenueFilterValue = "all" | string;

export type RevenueTransaction = {
  id: string;
  amount: number | string | null;
  created_at: string;
  currency: string | null;
  event_amount: number | string | null;
  event_id: string | null;
  kind: string | null;
  membership_fee_amount: number | string | null;
  metadata: unknown;
  registration_id: string | null;
  service_fee_amount: number | string | null;
  source: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_refund_id: string | null;
  user_id: string;
};

export type RevenueProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

export type RevenueEvent = {
  id: string;
  title: string | null;
  date: string | null;
};

export type RevenueExportRow = {
  id: string;
  transactionRowId: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  eventId: string;
  eventTitle: string;
  eventDate: string;
  paymentDate: string;
  refundDate: string;
  transactionReference: string;
  movementType: RevenueMovementType;
  movementLabel: string;
  amount: number;
  refundedAmount: number;
  currency: string;
  paymentStatus: RevenuePaymentStatus;
  paymentStatusLabel: string;
  source: string;
  sourceLabel: string;
  registrationId: string;
  stripeCheckoutSessionId: string;
  stripePaymentIntentId: string;
  stripeRefundId: string;
  notes: string;
  sortDate: string;
};

export type RevenueRowFilters = {
  eventId?: RevenueFilterValue;
  movementType?: RevenueFilterValue;
  paymentStatus?: RevenueFilterValue;
};

const DETAIL_HEADERS = [
  "Data pagamento",
  "Nome utente",
  "Cognome utente",
  "Email utente",
  "Evento associato",
  "ID evento",
  "Data evento",
  "ID transazione",
  "Tipo movimento",
  "Importo",
  "Valuta",
  "Stato pagamento",
  "Eventuale data rimborso",
  "Importo rimborsato",
  "ID pagamento interno",
  "ID registrazione",
  "Stripe checkout session",
  "Stripe payment intent",
  "Stripe refund",
  "Origine",
  "Note interne / causale",
];

const DETAIL_COLUMN_WIDTHS = [
  18, 18, 18, 30, 32, 24, 14, 34, 30, 12, 10, 16, 18, 18, 34, 34, 34, 34, 30, 24, 38,
];

const SUMMARY_COLUMN_WIDTHS = [34, 18, 12, 34, 34];

const MOVEMENT_LABELS: Record<RevenueMovementType, string> = {
  membership_fee: "Quota associativa",
  event_fee: "Quota partecipazione evento",
  service_fee: "Costo servizio",
  unclassified: "Movimento non classificato",
};

const REFUND_MOVEMENT_LABELS: Record<RevenueMovementType, string> = {
  membership_fee: "Rimborso quota associativa",
  event_fee: "Rimborso quota partecipazione evento",
  service_fee: "Rimborso costo servizio",
  unclassified: "Rimborso non classificato",
};

const PAYMENT_STATUS_LABELS: Record<RevenuePaymentStatus, string> = {
  paid: "Pagato",
  refunded: "Rimborsato",
  cancelled: "Annullato",
};

const SOURCE_LABELS: Record<string, string> = {
  event_checkout: "Evento",
  event_balance_checkout: "Saldo evento",
  membership_checkout: "Tessera",
  registration_change: "Cambio formula",
  event_cancellation_refund: "Rimborso cancellazione",
  event_cancelled_refund: "Rimborso evento annullato",
  event_checkout_auto_refund: "Rimborso automatico",
  legacy_event_registration: "Evento storico",
  legacy_event_refund: "Rimborso storico",
};

const COMPONENTS: Array<{ type: RevenueMovementType; field: keyof RevenueTransaction }> = [
  { type: "membership_fee", field: "membership_fee_amount" },
  { type: "service_fee", field: "service_fee_amount" },
  { type: "event_fee", field: "event_amount" },
];

const dateTimeFormatter = new Intl.DateTimeFormat("it-IT", {
  timeZone: "Europe/Rome",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const dateFormatter = new Intl.DateTimeFormat("it-IT", {
  timeZone: "Europe/Rome",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export const revenueMovementTypeOptions = [
  { value: "membership_fee", label: MOVEMENT_LABELS.membership_fee },
  { value: "event_fee", label: MOVEMENT_LABELS.event_fee },
  { value: "service_fee", label: MOVEMENT_LABELS.service_fee },
];

export const revenuePaymentStatusOptions = [
  { value: "paid", label: PAYMENT_STATUS_LABELS.paid },
  { value: "refunded", label: PAYMENT_STATUS_LABELS.refunded },
  { value: "cancelled", label: PAYMENT_STATUS_LABELS.cancelled },
];

export function buildRevenueExportRows(
  transactions: RevenueTransaction[],
  profiles: RevenueProfile[],
  events: RevenueEvent[],
  lookupTransactions: RevenueTransaction[] = transactions
) {
  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
  const eventMap = new Map(events.map((event) => [event.id, event]));
  const paymentDateByReference = buildPaymentDateByReference(lookupTransactions);

  return transactions
    .flatMap((transaction) => buildRowsForTransaction(transaction, profileMap, eventMap, paymentDateByReference))
    .sort((a, b) => {
      const dateDiff = new Date(a.sortDate || 0).getTime() - new Date(b.sortDate || 0).getTime();
      if (dateDiff !== 0) return dateDiff;
      return a.transactionReference.localeCompare(b.transactionReference) || a.movementLabel.localeCompare(b.movementLabel);
    });
}

export function filterRevenueRows(rows: RevenueExportRow[], filters: RevenueRowFilters) {
  return rows.filter((row) => {
    if (filters.eventId && filters.eventId !== "all" && row.eventId !== filters.eventId) return false;
    if (filters.movementType && filters.movementType !== "all" && row.movementType !== filters.movementType) return false;
    if (filters.paymentStatus && filters.paymentStatus !== "all" && row.paymentStatus !== filters.paymentStatus) return false;
    return true;
  });
}

export function summarizeRevenueRows(rows: RevenueExportRow[]) {
  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  const refunded = rows.reduce((sum, row) => sum + row.refundedAmount, 0);
  return {
    total,
    refunded,
    membership: sumByMovement(rows, "membership_fee"),
    events: sumByMovement(rows, "event_fee"),
    serviceFees: sumByMovement(rows, "service_fee"),
    rows: rows.length,
  };
}

export function createRevenueExportXlsxBlob(rows: RevenueExportRow[]) {
  return createXlsxBlob({
    creator: "Scampagnate Admin",
    sheets: [
      {
        name: "Dettaglio incassi",
        rows: [DETAIL_HEADERS, ...rows.map(revenueRowToSheetRow)],
        columnWidths: DETAIL_COLUMN_WIDTHS,
        freezeRows: 1,
        headerRows: 1,
      },
      {
        name: "Riepilogo",
        rows: buildRevenueSummarySheetRows(rows),
        columnWidths: SUMMARY_COLUMN_WIDTHS,
        freezeRows: 1,
        headerRows: 1,
      },
    ],
  });
}

export function exportRevenueXlsx(filename: string, rows: RevenueExportRow[]) {
  const blob = createRevenueExportXlsxBlob(rows);
  downloadBlob(blob, `${filename}_${new Date().toISOString().split("T")[0]}.xlsx`);
}

export function revenueRowsToCsv(rows: RevenueExportRow[]) {
  return [DETAIL_HEADERS, ...rows.map((row) => revenueRowToSheetRow(row).map((value) => String(value ?? "")))];
}

export function formatRevenueDateTime(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return dateTimeFormatter.format(date);
}

export function formatRevenueDate(value: string | null | undefined) {
  if (!value) return "";
  const isoDate = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDate && value.length <= 10) return `${isoDate[3]}/${isoDate[2]}/${isoDate[1]}`;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return dateFormatter.format(date);
}

export function revenueMoney(value: unknown) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
}

export function revenueSourceLabel(source: string | null | undefined) {
  const key = source || "";
  return SOURCE_LABELS[key] || key || "";
}

function buildRowsForTransaction(
  transaction: RevenueTransaction,
  profileMap: Map<string, RevenueProfile>,
  eventMap: Map<string, RevenueEvent>,
  paymentDateByReference: Map<string, string>
) {
  const paymentStatus = normalizePaymentStatus(transaction.kind);
  const transactionReference = transactionReferenceFor(transaction);
  const paymentDate = paymentStatus === "refunded"
    ? paymentDateByReference.get(transactionReference) || transaction.created_at
    : transaction.created_at;
  const refundDate = paymentStatus === "refunded" ? transaction.created_at : "";
  const components = COMPONENTS
    .map((component) => ({
      type: component.type,
      amount: signedComponentAmount(transaction[component.field], paymentStatus),
    }))
    .filter((component) => component.amount !== 0);

  if (components.length === 0 && revenueMoney(transaction.amount) !== 0) {
    components.push({
      type: "unclassified",
      amount: signedComponentAmount(transaction.amount, paymentStatus),
    });
  }

  return components.map((component) => {
    const profile = profileMap.get(transaction.user_id);
    const event = transaction.event_id ? eventMap.get(transaction.event_id) : null;
    const isRefund = paymentStatus === "refunded";
    const movementLabel = isRefund ? REFUND_MOVEMENT_LABELS[component.type] : MOVEMENT_LABELS[component.type];
    const notes = internalNoteFor(transaction, component.type);

    return {
      id: `${transaction.id}:${component.type}`,
      transactionRowId: transaction.id,
      userId: transaction.user_id,
      firstName: safeText(profile?.first_name),
      lastName: safeText(profile?.last_name),
      email: safeText(profile?.email),
      eventId: transaction.event_id || "",
      eventTitle: safeText(event?.title),
      eventDate: event?.date || "",
      paymentDate,
      refundDate,
      transactionReference,
      movementType: component.type,
      movementLabel,
      amount: roundMoney(component.amount),
      refundedAmount: isRefund ? roundMoney(Math.abs(component.amount)) : 0,
      currency: (transaction.currency || "EUR").toUpperCase(),
      paymentStatus,
      paymentStatusLabel: PAYMENT_STATUS_LABELS[paymentStatus],
      source: transaction.source || "",
      sourceLabel: revenueSourceLabel(transaction.source),
      registrationId: transaction.registration_id || "",
      stripeCheckoutSessionId: transaction.stripe_checkout_session_id || "",
      stripePaymentIntentId: transaction.stripe_payment_intent_id || "",
      stripeRefundId: transaction.stripe_refund_id || "",
      notes: notes || (component.type === "unclassified" ? "Componente economica non disponibile" : ""),
      sortDate: refundDate || paymentDate || transaction.created_at,
    } satisfies RevenueExportRow;
  });
}

function buildPaymentDateByReference(transactions: RevenueTransaction[]) {
  const dates = new Map<string, string>();
  transactions
    .filter((transaction) => normalizePaymentStatus(transaction.kind) === "paid")
    .forEach((transaction) => {
      const reference = transactionReferenceFor(transaction);
      if (!dates.has(reference) || transaction.created_at < dates.get(reference)!) {
        dates.set(reference, transaction.created_at);
      }
    });
  return dates;
}

function transactionReferenceFor(transaction: RevenueTransaction) {
  return (
    transaction.stripe_payment_intent_id
    || metadataString(transaction.metadata, [
      "stripe_payment_intent_id",
      "payment_intent",
      "paymentIntentId",
      "original_payment_intent_id",
      "originalPaymentIntentId",
    ])
    || transaction.stripe_checkout_session_id
    || metadataString(transaction.metadata, ["stripe_checkout_session_id", "checkout_session_id", "checkoutSessionId"])
    || transaction.stripe_refund_id
    || transaction.id
  );
}

function internalNoteFor(transaction: RevenueTransaction, movementType: RevenueMovementType) {
  const metadataNote = metadataString(transaction.metadata, ["internal_note", "note", "notes", "reason", "causale"]);
  if (metadataNote) return metadataNote;
  if (normalizePaymentStatus(transaction.kind) === "refunded" && movementType === "unclassified") {
    return "Rimborso senza componente economica dettagliata";
  }
  return "";
}

function metadataString(metadata: unknown, keys: string[]) {
  const record = metadataRecord(metadata);
  if (!record) return "";
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function metadataRecord(metadata: unknown): Record<string, unknown> | null {
  if (!metadata) return null;
  if (typeof metadata === "string") {
    try {
      const parsed = JSON.parse(metadata);
      return isRecord(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return isRecord(metadata) ? metadata : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizePaymentStatus(kind: string | null | undefined): RevenuePaymentStatus {
  if (kind === "refund") return "refunded";
  if (kind === "cancelled" || kind === "canceled" || kind === "void") return "cancelled";
  return "paid";
}

function signedComponentAmount(value: unknown, status: RevenuePaymentStatus) {
  const amount = Math.abs(revenueMoney(value));
  if (amount === 0) return 0;
  if (status === "refunded") return -amount;
  if (status === "cancelled") return 0;
  return amount;
}

function revenueRowToSheetRow(row: RevenueExportRow): XlsxCellValue[] {
  return [
    formatRevenueDateTime(row.paymentDate),
    row.firstName,
    row.lastName,
    row.email,
    row.eventTitle,
    row.eventId,
    formatRevenueDate(row.eventDate),
    row.transactionReference,
    row.movementLabel,
    row.amount,
    row.currency,
    row.paymentStatusLabel,
    formatRevenueDateTime(row.refundDate),
    row.refundedAmount || "",
    row.transactionRowId,
    row.registrationId,
    row.stripeCheckoutSessionId,
    row.stripePaymentIntentId,
    row.stripeRefundId,
    row.sourceLabel,
    row.notes,
  ];
}

function buildRevenueSummarySheetRows(rows: RevenueExportRow[]): XlsxCellValue[][] {
  const summary = summarizeRevenueRows(rows);
  const byEvent = groupRows(rows, (row) => row.eventId || "Nessun evento", (row) => row.eventTitle || "Nessun evento");
  const byUser = groupRows(rows, (row) => row.userId, (row) => `${row.lastName} ${row.firstName}`.trim() || row.email || row.userId);
  const byMovement = groupRows(rows, (row) => row.movementType, (row) => MOVEMENT_LABELS[row.movementType]);

  return [
    ["Indicatore", "Valore", "Righe", "ID", "Dettaglio"],
    ["Totale incassato tramite piattaforma", roundMoney(summary.total), summary.rows, "", ""],
    ["Totale quote associative incassate", roundMoney(summary.membership), "", "", ""],
    ["Totale quote evento incassate", roundMoney(summary.events), "", "", ""],
    ["Totale costi servizio incassati", roundMoney(summary.serviceFees), "", "", ""],
    ["Totale rimborsi", roundMoney(summary.refunded), "", "", ""],
    [],
    ["Totali per tipologia", "Valore", "Righe", "ID", "Dettaglio"],
    ...byMovement,
    [],
    ["Totali per evento", "Valore", "Righe", "ID", "Dettaglio"],
    ...byEvent,
    [],
    ["Totali per utente", "Valore", "Righe", "ID", "Dettaglio"],
    ...byUser,
  ];
}

function groupRows(
  rows: RevenueExportRow[],
  keyForRow: (row: RevenueExportRow) => string,
  labelForRow: (row: RevenueExportRow) => string
) {
  const groups = new Map<string, { label: string; total: number; count: number }>();
  for (const row of rows) {
    const key = keyForRow(row);
    const current = groups.get(key) || { label: labelForRow(row), total: 0, count: 0 };
    current.total += row.amount;
    current.count += 1;
    groups.set(key, current);
  }
  return [...groups.entries()]
    .sort(([, a], [, b]) => Math.abs(b.total) - Math.abs(a.total))
    .map(([key, value]) => [value.label, roundMoney(value.total), value.count, key, ""]);
}

function sumByMovement(rows: RevenueExportRow[], movementType: RevenueMovementType) {
  return rows
    .filter((row) => row.movementType === movementType)
    .reduce((sum, row) => sum + row.amount, 0);
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function safeText(value: string | number | null | undefined) {
  return String(value ?? "").trim();
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
