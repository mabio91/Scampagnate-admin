import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarDays, ChevronDown, Download, Euro, FileSpreadsheet, FileText, Receipt, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import RefreshButton from "@/components/RefreshButton";
import { supabase } from "@/integrations/supabase/client";
import { exportToCsv } from "@/lib/exportUtils";
import {
  buildRevenueExportRows,
  exportRevenueXlsx,
  filterRevenueRows,
  formatRevenueDate,
  formatRevenueDateTime,
  revenueMoney,
  revenueMovementTypeOptions,
  revenuePaymentStatusOptions,
  revenueRowsToCsv,
  summarizeRevenueRows,
  type RevenueEvent,
  type RevenueMovementType,
  type RevenuePaymentStatus,
  type RevenueProfile,
  type RevenueTransaction,
} from "@/lib/revenueExport";

type RevenueQueryData = {
  transactions: RevenueTransaction[];
  lookupTransactions: RevenueTransaction[];
  profiles: RevenueProfile[];
  events: RevenueEvent[];
};

const TRANSACTION_SELECT = "id, amount, created_at, currency, event_amount, event_id, kind, membership_fee_amount, metadata, registration_id, service_fee_amount, source, stripe_balance_transaction_id, stripe_checkout_session_id, stripe_fee_amount, stripe_net_amount, stripe_payment_intent_id, stripe_refund_id, user_id";

const quarterOptions = [
  { value: "1", label: "Q1" },
  { value: "2", label: "Q2" },
  { value: "3", label: "Q3" },
  { value: "4", label: "Q4" },
];

const euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });

export default function RevenueExportsPage() {
  const currentQuarter = getCurrentQuarter();
  const [dateFrom, setDateFrom] = useState(currentQuarter.from);
  const [dateTo, setDateTo] = useState(currentQuarter.to);
  const [quarters, setQuarters] = useState<string[]>([String(currentQuarter.quarter)]);
  const [year, setYear] = useState(String(currentQuarter.year));
  const [eventIds, setEventIds] = useState<string[]>([]);
  const [movementTypes, setMovementTypes] = useState<RevenueMovementType[]>([]);
  const [paymentStatuses, setPaymentStatuses] = useState<RevenuePaymentStatus[]>([]);

  const { data: eventOptions = [] } = useQuery({
    queryKey: ["admin-revenue-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, title, date")
        .order("date", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as RevenueEvent[];
    },
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-revenue-export", dateFrom, dateTo, eventIds],
    queryFn: () => fetchRevenueData(dateFrom, dateTo, eventIds),
  });

  const allRows = useMemo(() => {
    if (!data) return [];
    return buildRevenueExportRows(data.transactions, data.profiles, data.events, data.lookupTransactions);
  }, [data]);

  const rows = useMemo(
    () => filterRevenueRows(allRows, {
      eventIds,
      movementTypes,
      paymentStatuses,
      quarterYear: Number(year),
      quarters,
    }),
    [allRows, eventIds, movementTypes, paymentStatuses, quarters, year]
  );

  const summary = useMemo(() => summarizeRevenueRows(rows), [rows]);
  const previewRows = rows.slice(0, 100);
  const isExportDisabled = rows.length === 0;

  const applyQuarter = () => {
    const parsedYear = Number(year);
    if (!Number.isInteger(parsedYear) || parsedYear < 2000 || parsedYear > 2100) {
      toast.error("Anno non valido");
      return;
    }
    const range = quarterRangeForSelection(parsedYear, quarters);
    setDateFrom(range.from);
    setDateTo(range.to);
  };

  const exportFilename = () => `incassi_asd_${dateFrom || "inizio"}_${dateTo || "fine"}`;

  const handleExportXlsx = () => {
    exportRevenueXlsx(exportFilename(), rows);
    toast.success(`${rows.length} righe esportate in Excel`);
  };

  const handleExportCsv = () => {
    const [headers, ...csvRows] = revenueRowsToCsv(rows);
    exportToCsv(exportFilename(), headers, csvRows);
    toast.success(`${rows.length} righe esportate in CSV`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Export incassi ASD</h1>
          <p className="text-muted-foreground mt-1">{rows.length} righe economiche nel perimetro selezionato</p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshButton queryKeys={[["admin-revenue-export"], ["admin-revenue-events"]]} />
          <Button variant="outline" className="gap-2" onClick={handleExportCsv} disabled={isExportDisabled}>
            <FileText className="h-4 w-4" />
            CSV
          </Button>
          <Button className="gap-2" onClick={handleExportXlsx} disabled={isExportDisabled}>
            <Download className="h-4 w-4" />
            Excel
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard icon={Euro} label="Totale piattaforma" value={euro.format(summary.total)} />
        <SummaryCard icon={Receipt} label="Quote evento" value={euro.format(summary.events)} />
        <SummaryCard icon={FileSpreadsheet} label="Quote associative" value={euro.format(summary.membership)} />
        <SummaryCard icon={CalendarDays} label="Costi servizio" value={euro.format(summary.serviceFees)} />
        <SummaryCard icon={RotateCcw} label="Rimborsi" value={euro.format(summary.refunded)} tone="warning" />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <div className="space-y-2">
              <Label htmlFor="date-from">Da</Label>
              <Input id="date-from" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date-to">A</Label>
              <Input id="date-to" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
            </div>
            <div className="grid grid-cols-[1fr_88px_auto] gap-2">
              <div className="space-y-2">
                <Label>Trimestri</Label>
                <MultiCheckboxFilter
                  allLabel="Tutti"
                  options={quarterOptions}
                  selectedValues={quarters}
                  onChange={setQuarters}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quarter-year">Anno</Label>
                <Input id="quarter-year" inputMode="numeric" value={year} onChange={(event) => setYear(event.target.value)} />
              </div>
              <div className="flex items-end">
                <Button type="button" variant="outline" size="icon" onClick={applyQuarter} title="Applica trimestre">
                  <CalendarDays className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <MultiCheckboxField
              label="Eventi"
              allLabel="Tutti gli eventi"
              options={eventOptions.map((event) => ({ value: event.id, label: event.title || event.id }))}
              selectedValues={eventIds}
              onChange={setEventIds}
            />
            <MultiCheckboxField
              label="Tipo"
              allLabel="Tutti"
              options={revenueMovementTypeOptions}
              selectedValues={movementTypes}
              onChange={(values) => setMovementTypes(values as RevenueMovementType[])}
            />
            <MultiCheckboxField
              label="Stato"
              allLabel="Tutti"
              options={revenuePaymentStatusOptions}
              selectedValues={paymentStatuses}
              onChange={(values) => setPaymentStatuses(values as RevenuePaymentStatus[])}
            />
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {error ? (
            <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-3 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" />
              {(error as Error).message}
            </div>
          ) : isLoading ? (
            <div className="space-y-3">{Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-12" />)}</div>
          ) : rows.length === 0 ? (
            <div className="rounded-md border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
              Nessun incasso online trovato per i filtri selezionati.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Utente</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead>Transazione</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead className="text-right">Totale orig.</TableHead>
                  <TableHead className="text-right">Importo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-sm">{formatRevenueDateTime(row.refundDate || row.paymentDate)}</TableCell>
                    <TableCell>
                      <div className="font-medium whitespace-nowrap">{`${row.firstName} ${row.lastName}`.trim() || "Senza nome"}</div>
                      <div className="text-xs text-muted-foreground">{row.email || row.userId}</div>
                    </TableCell>
                    <TableCell>
                      <div className="min-w-[220px] font-medium">{row.eventTitle || "Nessun evento"}</div>
                      {row.eventDate && <div className="text-xs text-muted-foreground">{formatRevenueDate(row.eventDate)}</div>}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{row.transactionReference}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="whitespace-nowrap">{row.movementLabel}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.paymentStatus === "refunded" ? "secondary" : "default"} className="whitespace-nowrap">
                        {row.paymentStatusLabel}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.originalTransactionTotal == null ? "—" : euro.format(row.originalTransactionTotal)}
                    </TableCell>
                    <TableCell className={`text-right font-semibold tabular-nums ${row.amount < 0 ? "text-destructive" : ""}`}>
                      {euro.format(row.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {rows.length > previewRows.length && (
            <p className="mt-3 text-xs text-muted-foreground">Anteprima limitata a 100 righe. L'export include tutte le {rows.length} righe.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

async function fetchRevenueData(dateFrom: string, dateTo: string, eventIds: string[]): Promise<RevenueQueryData> {
  let query = supabase
    .from("user_payment_transactions")
    .select(TRANSACTION_SELECT)
    .order("created_at", { ascending: true });

  if (dateFrom) query = query.gte("created_at", startOfLocalDayIso(dateFrom));
  if (dateTo) query = query.lte("created_at", endOfLocalDayIso(dateTo));
  if (eventIds.length > 0) query = query.in("event_id", eventIds);

  const { data: transactionsData, error } = await query;
  if (error) throw error;

  const transactions = await hydrateStripeFeeDetails((transactionsData || []) as RevenueTransaction[]);
  const lookupTransactions = await fetchLookupPayments(transactions);
  const userIds = unique(transactions.map((transaction) => transaction.user_id).filter(Boolean));
  const lookupEventIds = unique(
    [...transactions, ...lookupTransactions].map((transaction) => transaction.event_id).filter(Boolean) as string[]
  );

  const [profiles, events] = await Promise.all([
    fetchProfiles(userIds),
    fetchEvents(lookupEventIds),
  ]);

  return { transactions, lookupTransactions: [...transactions, ...lookupTransactions], profiles, events };
}

type StripeFeeLookupResponse = {
  fees?: Record<string, {
    stripe_balance_transaction_id?: string | null;
    stripe_fee_amount?: number | null;
    stripe_net_amount?: number | null;
  }>;
};

async function hydrateStripeFeeDetails(transactions: RevenueTransaction[]) {
  const paymentIntentIds = unique(
    transactions
      .filter((transaction) =>
        transaction.kind === "payment"
        && transaction.stripe_payment_intent_id
        && revenueMoney(transaction.stripe_fee_amount) <= 0
      )
      .map((transaction) => transaction.stripe_payment_intent_id as string)
  );

  if (paymentIntentIds.length === 0) return transactions;

  const feeDetails = new Map<string, NonNullable<StripeFeeLookupResponse["fees"]>[string]>();

  for (const chunk of chunkValues(paymentIntentIds, 100)) {
    const { data, error } = await supabase.functions.invoke<StripeFeeLookupResponse>("admin-stripe-fees", {
      body: { paymentIntentIds: chunk },
    });
    if (error) {
      console.warn("Stripe fee lookup unavailable:", error.message);
      continue;
    }

    for (const [paymentIntentId, details] of Object.entries(data?.fees || {})) {
      feeDetails.set(paymentIntentId, details);
    }
  }

  if (feeDetails.size === 0) return transactions;

  return transactions.map((transaction) => {
    const details = transaction.stripe_payment_intent_id ? feeDetails.get(transaction.stripe_payment_intent_id) : null;
    if (!details) return transaction;
    return {
      ...transaction,
      stripe_balance_transaction_id: details.stripe_balance_transaction_id || transaction.stripe_balance_transaction_id,
      stripe_fee_amount: details.stripe_fee_amount ?? transaction.stripe_fee_amount,
      stripe_net_amount: details.stripe_net_amount ?? transaction.stripe_net_amount,
    };
  });
}

async function fetchLookupPayments(transactions: RevenueTransaction[]) {
  const paymentIntentIds = unique(
    transactions
      .filter((transaction) => transaction.kind === "refund" && transaction.stripe_payment_intent_id)
      .map((transaction) => transaction.stripe_payment_intent_id as string)
  );

  if (paymentIntentIds.length === 0) return [];

  const { data, error } = await supabase
    .from("user_payment_transactions")
    .select(TRANSACTION_SELECT)
    .eq("kind", "payment")
    .in("stripe_payment_intent_id", paymentIntentIds);
  if (error) throw error;
  return (data || []) as RevenueTransaction[];
}

async function fetchProfiles(userIds: string[]) {
  if (userIds.length === 0) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email")
    .in("id", userIds);
  if (error) throw error;
  return (data || []) as RevenueProfile[];
}

async function fetchEvents(eventIds: string[]) {
  if (eventIds.length === 0) return [];
  const { data, error } = await supabase
    .from("events")
    .select("id, title, date")
    .in("id", eventIds);
  if (error) throw error;
  return (data || []) as RevenueEvent[];
}

function SummaryCard({ icon: Icon, label, value, tone = "default" }: { icon: typeof Euro; label: string; value: string; tone?: "default" | "warning" }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-md ${tone === "warning" ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary"}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="truncate text-lg font-bold tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

type MultiCheckboxOption = {
  value: string;
  label: string;
};

function MultiCheckboxField({
  label,
  options,
  selectedValues,
  onChange,
  allLabel,
}: {
  label: string;
  options: MultiCheckboxOption[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  allLabel: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <MultiCheckboxFilter
        allLabel={allLabel}
        options={options}
        selectedValues={selectedValues}
        onChange={onChange}
      />
    </div>
  );
}

function MultiCheckboxFilter({
  options,
  selectedValues,
  onChange,
  allLabel,
}: {
  options: MultiCheckboxOption[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  allLabel: string;
}) {
  const selectedOptions = options.filter((option) => selectedValues.includes(option.value));
  const label = selectedOptions.length === 0
    ? allLabel
    : selectedOptions.length === 1
      ? selectedOptions[0].label
      : `${selectedOptions.length} selezionati`;

  const toggleValue = (value: string, checked: boolean) => {
    const nextValues = checked
      ? unique([...selectedValues, value])
      : selectedValues.filter((selectedValue) => selectedValue !== value);
    onChange(nextValues);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" className="h-10 w-full justify-between gap-2 font-normal">
          <span className="truncate">{label}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-72 w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto">
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.value}
            checked={selectedValues.includes(option.value)}
            onCheckedChange={(checked) => toggleValue(option.value, checked === true)}
            onSelect={(event) => event.preventDefault()}
          >
            <span className="truncate">{option.label}</span>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function getCurrentQuarter() {
  const now = new Date();
  const year = now.getFullYear();
  const quarter = Math.floor(now.getMonth() / 3) + 1;
  return { year, quarter, ...quarterRange(year, quarter) };
}

function quarterRangeForSelection(year: number, selectedQuarters: string[]) {
  const parsedQuarters = selectedQuarters
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value >= 1 && value <= 4)
    .sort((a, b) => a - b);
  const quarters = parsedQuarters.length > 0 ? parsedQuarters : [1, 2, 3, 4];
  const from = quarterRange(year, quarters[0]).from;
  const to = quarterRange(year, quarters[quarters.length - 1]).to;
  return { from, to };
}

function quarterRange(year: number, quarter: number) {
  const startMonth = (quarter - 1) * 3;
  const start = new Date(year, startMonth, 1);
  const end = new Date(year, startMonth + 3, 0);
  return {
    from: inputDate(start),
    to: inputDate(end),
  };
}

function inputDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfLocalDayIso(value: string) {
  return new Date(`${value}T00:00:00`).toISOString();
}

function endOfLocalDayIso(value: string) {
  return new Date(`${value}T23:59:59.999`).toISOString();
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function chunkValues<T>(values: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}
