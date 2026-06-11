import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertTriangle,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Euro,
  FileText,
  MapPin,
  Phone,
  ShieldCheck,
  UserRound,
  XCircle,
} from "lucide-react";
import { formatMembershipId } from "@/lib/membership";
import {
  formatMembershipDateValue,
  getMembershipCompleteness,
  getMembershipDisplayName,
  getMembershipStatusLabel,
  type MembershipDataField,
  type MembershipProfileData,
} from "@/lib/membershipProfile";

export type MembershipPaymentRow = {
  id: string;
  kind: string;
  source: string;
  amount: number | string | null;
  membership_fee_amount: number | string | null;
  created_at: string;
  stripe_payment_intent_id?: string | null;
  stripe_refund_id?: string | null;
};

type MembershipDossierProps = {
  profile: MembershipProfileData & {
    id?: string;
    is_founding_member?: boolean | null;
    membership_registration_date?: string | null;
    membership_subscription_order?: number | null;
  };
  payments?: MembershipPaymentRow[];
  paymentsLoading?: boolean;
};

const euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });

const money = (value: unknown) => {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
};

const formatEuro = (value: unknown) => euro.format(money(value));

const fieldGroups: Array<{ title: string; icon: typeof UserRound; keys: MembershipDataField["key"][] }> = [
  { title: "Anagrafica", icon: UserRound, keys: ["first_name", "last_name", "sex", "birth_date"] },
  { title: "Nascita", icon: CalendarDays, keys: ["birth_place", "province_of_birth"] },
  { title: "Residenza", icon: MapPin, keys: ["residential_address", "city_of_residence", "province_of_residence"] },
  { title: "Contatti", icon: Phone, keys: ["phone", "email"] },
];

export function MembershipDossier({ profile, payments = [], paymentsLoading = false }: MembershipDossierProps) {
  const completeness = getMembershipCompleteness(profile);
  const fieldsByKey = new Map(completeness.fields.map((field) => [field.key, field]));
  const membershipPayments = payments.filter(
    (payment) => money(payment.membership_fee_amount) > 0 || payment.source.toLowerCase().includes("membership"),
  );
  const membershipPaid = membershipPayments
    .filter((payment) => payment.kind !== "refund")
    .reduce((sum, payment) => {
      const membershipFee = money(payment.membership_fee_amount);
      return sum + (membershipFee > 0 ? membershipFee : money(payment.amount));
    }, 0);
  const lastPayment = membershipPayments[0];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-xl">{getMembershipDisplayName(profile)}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Dossier tesseramento e dati export AICS</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <MembershipStatusBadge status={profile.membership_status} />
              {profile.is_founding_member && (
                <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-700">
                  Socio fondatore
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryTile icon={CreditCard} label="ID tessera" value={formatMembershipId(profile.membership_id)} mono />
            <SummaryTile icon={CalendarDays} label="Anno tessera" value={profile.membership_year?.toString() || "—"} />
            <SummaryTile
              icon={BadgeCheck}
              label="Data attivazione"
              value={formatMembershipDateValue(profile.membership_registration_date)}
            />
            <SummaryTile
              icon={ShieldCheck}
              label="Ordine adesione"
              value={profile.membership_subscription_order ? `#${profile.membership_subscription_order}` : "—"}
            />
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">Completezza dati AICS</p>
                <p className="text-sm text-muted-foreground">
                  {completeness.completedCount}/{completeness.totalCount} campi compilati
                </p>
              </div>
              <Badge
                variant={completeness.isComplete ? "outline" : "secondary"}
                className={
                  completeness.isComplete
                    ? "border-green-500/25 bg-green-500/10 text-green-700"
                    : "border-yellow-500/25 bg-yellow-500/10 text-yellow-700"
                }
              >
                {completeness.isComplete ? "Pronto per export" : "Dati da completare"}
              </Badge>
            </div>
            <Progress value={completeness.percentage} className="h-2" />
            {!completeness.isComplete && (
              <div className="flex flex-wrap gap-1.5">
                {completeness.missingFields.map((field) => (
                  <Badge key={field.key} variant="outline" className="border-yellow-500/25 bg-yellow-500/5 text-xs">
                    {field.label}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        {fieldGroups.map((group) => (
          <Card key={group.title}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <group.icon className="h-4 w-4 text-primary" />
                {group.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {group.keys.map((key) => {
                const field = fieldsByKey.get(key);
                return field ? <MembershipField key={field.key} field={field} /> : null;
              })}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Euro className="h-4 w-4 text-primary" />
            Pagamenti tessera
          </CardTitle>
        </CardHeader>
        <CardContent>
          {paymentsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10" />
              <Skeleton className="h-20" />
            </div>
          ) : membershipPayments.length === 0 ? (
            <div className="flex items-start gap-3 rounded-md border bg-muted/20 p-4">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600" />
              <div>
                <p className="text-sm font-medium">Nessun pagamento tessera trovato</p>
                <p className="text-sm text-muted-foreground">La tessera potrebbe essere stata attivata manualmente o importata.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <SummaryTile icon={Euro} label="Totale quote tessera" value={formatEuro(membershipPaid)} />
                <SummaryTile
                  icon={FileText}
                  label="Ultimo movimento"
                  value={lastPayment ? formatMembershipDateValue(lastPayment.created_at) : "—"}
                />
              </div>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Origine</TableHead>
                      <TableHead>Quota</TableHead>
                      <TableHead>Riferimento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {membershipPayments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="whitespace-nowrap text-sm">{formatMembershipDateValue(payment.created_at)}</TableCell>
                        <TableCell>
                          <Badge variant={payment.kind === "refund" ? "secondary" : "default"}>
                            {payment.kind === "refund" ? "Rimborso" : "Pagamento"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{paymentSourceLabel(payment.source)}</TableCell>
                        <TableCell className="font-medium tabular-nums">
                          {formatEuro(money(payment.membership_fee_amount) || payment.amount)}
                        </TableCell>
                        <TableCell className="max-w-[220px] truncate font-mono text-xs text-muted-foreground">
                          {payment.stripe_refund_id || payment.stripe_payment_intent_id || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MembershipStatusBadge({ status }: { status?: string | null }) {
  const isActive = status === "Active";
  const isExpired = status === "Expired";

  return (
    <Badge
      variant={isActive ? "outline" : "secondary"}
      className={
        isActive
          ? "border-green-500/25 bg-green-500/10 text-green-700"
          : isExpired
            ? "border-red-500/25 bg-red-500/10 text-red-700"
            : ""
      }
    >
      {getMembershipStatusLabel(status)}
    </Badge>
  );
}

function SummaryTile({
  icon: Icon,
  label,
  value,
  mono = false,
}: {
  icon: typeof CreditCard;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <p className={`mt-1 font-semibold ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}

function MembershipField({ field }: { field: MembershipDataField }) {
  const StatusIcon = field.complete ? CheckCircle2 : XCircle;

  return (
    <div className="min-w-0 rounded-md border bg-background p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-muted-foreground">{field.label}</p>
        <StatusIcon className={`mt-0.5 h-4 w-4 shrink-0 ${field.complete ? "text-green-600" : "text-red-600"}`} />
      </div>
      <p className="mt-1 break-words text-sm font-medium">{field.displayValue}</p>
    </div>
  );
}

function paymentSourceLabel(source: string) {
  const labels: Record<string, string> = {
    membership_checkout: "Tessera",
    event_checkout: "Evento",
    event_balance_checkout: "Saldo evento",
    registration_change: "Cambio formula",
    event_cancellation_refund: "Rimborso cancellazione",
    event_cancelled_refund: "Rimborso evento annullato",
    event_checkout_auto_refund: "Rimborso automatico",
    legacy_event_registration: "Evento storico",
    legacy_event_refund: "Rimborso storico",
  };
  return labels[source] || source;
}
