import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, MoreHorizontal, Edit2, Download, CreditCard, AlertTriangle, Bell, CalendarX, Award, Shield, Euro, Save, Pencil, ArrowUp, ArrowDown, Eye, FileWarning, UserRound } from "lucide-react";
import RefreshButton from "@/components/RefreshButton";
import { RowActionButton, RowActionCell } from "@/components/RowActions";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { useLanguage } from "@/i18n/LanguageContext";
import { exportAicsMembershipXlsx } from "@/lib/aicsMembershipExport";
import { exportToCsv } from "@/lib/exportUtils";
import { FOUNDING_MEMBER_BADGE_NAME, countMembersWithFoundingMemberBadge, hasFoundingMemberBadge } from "@/lib/foundingMember";
import { formatMembershipId } from "@/lib/membership";
import { getMembershipCompleteness, hasActiveMembership, membershipDataFieldLabels } from "@/lib/membershipProfile";
import { MembershipDossier, type MembershipPaymentRow } from "@/components/members/MembershipDossier";
import { PrepaidMembershipImport } from "@/components/members/PrepaidMembershipImport";

type Profile = Tables<"profiles">;
type SortDirection = "asc" | "desc";
type MemberSortField = "membershipId" | "name" | "phone" | "year" | "badges" | "accountStatus" | "membershipStatus" | "completeness";
type MemberSort = { field: MemberSortField; direction: SortDirection } | null;
type MemberSegment = "all" | "active" | "expired" | "currentYear" | "incomplete" | "withoutId" | "founding";
type UserBadgeRow = {
  user_id: string;
  badge_id: string;
  badges: { name: string | null; icon: string | null } | null;
};

const getOptionalProfileString = (profile: Profile, fieldNames: string[]) => {
  const record = profile as Profile & Record<string, unknown>;
  for (const fieldName of fieldNames) {
    const value = record[fieldName];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
};

const getMemberSex = (profile: Profile) => getOptionalProfileString(profile, ["gender", "sex", "sesso"]);

export default function MembersPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState<MemberSegment>("all");
  const [sort, setSort] = useState<MemberSort>(null);
  const [editMember, setEditMember] = useState<Profile | null>(null);
  const [selectedMember, setSelectedMember] = useState<Profile | null>(null);
  const [editForm, setEditForm] = useState({
    membership_id: "",
    membership_status: "Inactive",
    membership_year: new Date().getFullYear().toString(),
    is_founding_member: false,
  });
  const [showBulkExpireDialog, setShowBulkExpireDialog] = useState(false);
  const [bulkExpireYear, setBulkExpireYear] = useState((new Date().getFullYear() - 1).toString());
  const [showRenewalDialog, setShowRenewalDialog] = useState(false);
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceValue, setPriceValue] = useState("");
  const [editingFoundingLimit, setEditingFoundingLimit] = useState(false);
  const [foundingLimitValue, setFoundingLimitValue] = useState("");
  const queryClient = useQueryClient();

  const currentYear = new Date().getFullYear();

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["admin-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("membership_id", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch all badges and user_badges for badge management
  const { data: allBadges = [] } = useQuery({
    queryKey: ["all-badges"],
    queryFn: async () => {
      const { data, error } = await supabase.from("badges").select("*").order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: userBadgesMap = {} } = useQuery({
    queryKey: ["all-user-badges"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_badges").select("user_id, badge_id, badges(name, icon)");
      if (error) throw error;
      const map: Record<string, { badge_id: string; name: string; icon: string }[]> = {};
      ((data || []) as unknown as UserBadgeRow[]).forEach((ub) => {
        if (!map[ub.user_id]) map[ub.user_id] = [];
        map[ub.user_id].push({ badge_id: ub.badge_id, name: ub.badges?.name || "", icon: ub.badges?.icon || "" });
      });
      return map;
    },
  });

  const { data: selectedMemberPayments = [], isLoading: selectedMemberPaymentsLoading } = useQuery({
    queryKey: ["admin-member-payments", selectedMember?.id],
    queryFn: async () => {
      if (!selectedMember?.id) return [];
      const { data, error } = await supabase
        .from("user_payment_transactions")
        .select("id, kind, source, amount, membership_fee_amount, created_at, stripe_payment_intent_id, stripe_refund_id")
        .eq("user_id", selectedMember.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as MembershipPaymentRow[];
    },
    enabled: !!selectedMember?.id,
  });

  // Fetch membership price from platform_settings
  const { data: membershipPriceSetting } = useQuery({
    queryKey: ["membership-price-setting"],
    queryFn: async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("*")
        .eq("key", "membership_fee")
        .maybeSingle();
      return data;
    },
  });

  // Fetch founding member limit from platform_settings
  const { data: foundingLimitSetting } = useQuery({
    queryKey: ["founding-limit-setting"],
    queryFn: async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("*")
        .eq("key", "founding_member_limit")
        .maybeSingle();
      return data;
    },
  });

  const foundingLimit = parseInt(foundingLimitSetting?.value || "150");

  const saveFoundingLimitMutation = useMutation({
    mutationFn: async (newLimit: string) => {
      if (foundingLimitSetting) {
        const { error } = await supabase
          .from("platform_settings")
          .update({ value: newLimit, updated_at: new Date().toISOString() })
          .eq("id", foundingLimitSetting.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("platform_settings")
          .insert({ key: "founding_member_limit", label: "Limite Founding Member", description: "Numero massimo di founding member ammessi", value: newLimit });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["founding-limit-setting"] });
      queryClient.invalidateQueries({ queryKey: ["platform-settings"] });
      setEditingFoundingLimit(false);
      toast.success("Limite founding member aggiornato");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const savePriceMutation = useMutation({
    mutationFn: async (newPrice: string) => {
      if (membershipPriceSetting) {
        const { error } = await supabase
          .from("platform_settings")
          .update({ value: newPrice, updated_at: new Date().toISOString() })
          .eq("id", membershipPriceSetting.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("platform_settings")
          .insert({ key: "membership_fee", label: "Quota Tessera ASD", description: "Prezzo tessera associativa annuale", value: newPrice });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["membership-price-setting"] });
      queryClient.invalidateQueries({ queryKey: ["platform-settings"] });
      setEditingPrice(false);
      toast.success("Prezzo tessera aggiornato");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMembership = useMutation({
    mutationFn: async () => {
      if (!editMember) return;
      const { error } = await supabase
        .from("profiles")
        .update({
          membership_id: editForm.membership_id ? parseInt(editForm.membership_id) : null,
          membership_status: editForm.membership_status,
          membership_year: editForm.membership_year ? parseInt(editForm.membership_year) : null,
          is_founding_member: editForm.is_founding_member,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editMember.id);
      if (error) throw error;

      // Handle Founding Member badge sync
      const foundingBadge = allBadges.find((b) => b.name === FOUNDING_MEMBER_BADGE_NAME);
      if (foundingBadge) {
        const hasBadge = hasFoundingMemberBadge(userBadgesMap[editMember.id]);
        if (editForm.is_founding_member && !hasBadge) {
          await supabase.from("user_badges").insert({ user_id: editMember.id, badge_id: foundingBadge.id });
        } else if (!editForm.is_founding_member && hasBadge) {
          await supabase.from("user_badges").delete().eq("user_id", editMember.id).eq("badge_id", foundingBadge.id);
        }
      }
    },
    onSuccess: () => {
      toast.success("Membership updated");
      queryClient.invalidateQueries({ queryKey: ["admin-members"] });
      queryClient.invalidateQueries({ queryKey: ["all-user-badges"] });
      setEditMember(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const exportMembers = () => {
    const activeMembers = members.filter((m) => m.membership_status === "Active");

    exportAicsMembershipXlsx(
      "modello_importazione_soci",
      activeMembers.map((m) => ({
        first_name: m.first_name,
        last_name: m.last_name,
        sex: getMemberSex(m),
        birth_date: m.birth_date,
        province_of_birth: m.province_of_birth,
        birth_place: m.birth_place,
        residential_address: m.residential_address,
        province_of_residence: m.province_of_residence,
        city_of_residence: m.city_of_residence,
        phone: m.phone,
        email: m.email,
      }))
    );
    toast.success(`${activeMembers.length} tesserati attivi esportati in Excel`);
  };

  const bulkExpireMemberships = useMutation({
    mutationFn: async () => {
      const yearNum = parseInt(bulkExpireYear);
      const { data: toExpire, error: fetchError } = await supabase
        .from("profiles")
        .select("id")
        .eq("membership_status", "Active")
        .lte("membership_year", yearNum);
      if (fetchError) throw fetchError;
      if (!toExpire || toExpire.length === 0) throw new Error("No active memberships found for the selected year or earlier.");

      const ids = toExpire.map((p) => p.id);
      const { error } = await supabase
        .from("profiles")
        .update({ membership_status: "Expired", updated_at: new Date().toISOString() })
        .in("id", ids);
      if (error) throw error;
      return ids.length;
    },
    onSuccess: (count) => {
      toast.success(`${count} membership(s) expired successfully`);
      queryClient.invalidateQueries({ queryKey: ["admin-members"] });
      setShowBulkExpireDialog(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendRenewalReminders = useMutation({
    mutationFn: async () => {
      const expiredMembers = members.filter(
        (m) => m.membership_status === "Expired" && m.membership_id
      );
      if (expiredMembers.length === 0) throw new Error("No expired members to notify.");

      const notifications = expiredMembers.map((m) => ({
        user_id: m.id,
        type: "membership_renewal",
        title: "Rinnovo tessera richiesto",
        message: `La tua tessera associativa (anno ${m.membership_year || "precedente"}) è scaduta. Rinnova per continuare a partecipare agli eventi.`,
      }));

      // Insert in batches of 100
      for (let i = 0; i < notifications.length; i += 100) {
        const batch = notifications.slice(i, i + 100);
        const { error } = await supabase.from("notifications").insert(batch);
        if (error) throw error;
      }
      return expiredMembers.length;
    },
    onSuccess: (count) => {
      toast.success(`Renewal reminders sent to ${count} expired member(s)`);
      setShowRenewalDialog(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openEdit = (member: Profile) => {
    setEditMember(member);
    setEditForm({
      membership_id: member.membership_id?.toString() || "",
      membership_status: member.membership_status || "Inactive",
      membership_year: member.membership_year?.toString() || new Date().getFullYear().toString(),
      is_founding_member: member.is_founding_member || false,
    });
  };

  const getMemberName = (member: Profile) => `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim();
  const getMemberBadgeText = (memberId: string) => (userBadgesMap[memberId] || []).map((badge) => badge.name).join(", ");
  const getCompleteness = (member: Profile) => getMembershipCompleteness(member);
  const isMembershipRelevant = (member: Profile) =>
    member.membership_status === "Active" || member.membership_status === "Pending" || member.membership_id != null;

  const matchesSegment = (member: Profile) => {
    if (segment === "active") return member.membership_status === "Active";
    if (segment === "expired") return member.membership_status === "Expired";
    if (segment === "currentYear") return hasActiveMembership(member, currentYear);
    if (segment === "incomplete") return isMembershipRelevant(member) && !getCompleteness(member).isComplete;
    if (segment === "withoutId") return !member.membership_id;
    if (segment === "founding") return member.is_founding_member || hasFoundingMemberBadge(userBadgesMap[member.id]);
    return true;
  };

  const filtered = members.filter((m) => {
    const normalizedSearch = search.toLowerCase().trim();
    const searchable = [
      getMemberName(m),
      m.phone || "",
      m.email || "",
      m.membership_id?.toString() || "",
    ].join(" ").toLowerCase();

    return matchesSegment(m) && (!normalizedSearch || searchable.includes(normalizedSearch));
  });

  const compareText = (a: string | null | undefined, b: string | null | undefined) => {
    const valueA = (a || "").trim();
    const valueB = (b || "").trim();
    if (!valueA && !valueB) return 0;
    if (!valueA) return 1;
    if (!valueB) return -1;
    return valueA.localeCompare(valueB, "it", { sensitivity: "base" });
  };

  const compareNumber = (a: number | null | undefined, b: number | null | undefined) => {
    if (a == null && b == null) return 0;
    if (a == null) return 1;
    if (b == null) return -1;
    return a - b;
  };

  const applySortDirection = (comparison: number, direction: SortDirection) => {
    if (comparison === 0) return 0;
    return direction === "asc" ? comparison : -comparison;
  };

  const sortedMembers = sort
    ? [...filtered].sort((a, b) => {
        let comparison = 0;
        if (sort.field === "membershipId") comparison = compareNumber(a.membership_id, b.membership_id);
        else if (sort.field === "name") comparison = compareText(getMemberName(a), getMemberName(b));
        else if (sort.field === "phone") comparison = compareText(a.phone, b.phone);
        else if (sort.field === "year") comparison = compareNumber(a.membership_year, b.membership_year);
        else if (sort.field === "badges") comparison = compareText(getMemberBadgeText(a.id), getMemberBadgeText(b.id));
        else if (sort.field === "accountStatus") comparison = compareText(a.account_status || "Active", b.account_status || "Active");
        else if (sort.field === "membershipStatus") comparison = compareText(a.membership_status || "Inactive", b.membership_status || "Inactive");
        else if (sort.field === "completeness") comparison = compareNumber(getCompleteness(a).percentage, getCompleteness(b).percentage);

        const directedComparison = applySortDirection(comparison, sort.direction);
        return directedComparison || compareText(getMemberName(a), getMemberName(b));
      })
    : filtered;

  const toggleSort = (field: MemberSortField) => {
    setSort((current) => (
      current?.field === field
        ? { field, direction: current.direction === "asc" ? "desc" : "asc" }
        : { field, direction: "asc" }
    ));
  };

  const renderSortIcon = (field: MemberSortField) => {
    if (sort?.field !== field) return <ArrowDown className="h-3.5 w-3.5 opacity-40" />;
    return sort.direction === "asc"
      ? <ArrowUp className="h-3.5 w-3.5" />
      : <ArrowDown className="h-3.5 w-3.5" />;
  };

  const renderSortableHead = (field: MemberSortField, label: string, ariaLabel: string) => (
    <TableHead>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="-ml-3 h-8 gap-1 px-2"
        onClick={() => toggleSort(field)}
        aria-label={ariaLabel}
      >
        {label}
        {renderSortIcon(field)}
      </Button>
    </TableHead>
  );

  const activeCount = members.filter((m) => m.membership_status === "Active").length;
  const expiredCount = members.filter((m) => m.membership_status === "Expired").length;
  const currentYearCount = members.filter((m) => hasActiveMembership(m, currentYear)).length;
  const foundingCount = countMembersWithFoundingMemberBadge(members, userBadgesMap);
  const incompleteCount = members.filter((m) => isMembershipRelevant(m) && !getCompleteness(m).isComplete).length;

  const exportIncompleteMembers = () => {
    const incompleteMembers = members
      .map((member) => ({ member, completeness: getCompleteness(member) }))
      .filter(({ member, completeness }) => isMembershipRelevant(member) && !completeness.isComplete);

    exportToCsv(
      "tesserati_dati_incompleti",
      ["ID tessera", "Nome", "Email", "Telefono", "Stato tessera", "Anno", "Completezza", "Campi mancanti"],
      incompleteMembers.map(({ member, completeness }) => [
        formatMembershipId(member.membership_id),
        getMemberName(member),
        member.email || "",
        member.phone || "",
        member.membership_status || "",
        member.membership_year?.toString() || "",
        `${completeness.percentage}%`,
        completeness.missingFields.map((field) => membershipDataFieldLabels[field.key]).join("; "),
      ]),
    );
    toast.success(`${incompleteMembers.length} tesserati con dati incompleti esportati in CSV`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">{t("members.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("members.subtitle")} ({members.length} {t("common.total").toLowerCase()})</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <RefreshButton queryKeys={[["admin-members"], ["all-badges"], ["all-user-badges"], ["prepaid-memberships"]]} />
          <Button variant="destructive" className="gap-2" onClick={() => setShowBulkExpireDialog(true)}>
            <CalendarX className="h-4 w-4" /> {t("members.bulkExpire")}
          </Button>
          <Button variant="secondary" className="gap-2" onClick={() => setShowRenewalDialog(true)}>
            <Bell className="h-4 w-4" /> {t("members.sendRenewalReminders")}
          </Button>
          <Button variant="outline" className="gap-2" onClick={exportIncompleteMembers}>
            <FileWarning className="h-4 w-4" /> Esporta incompleti
          </Button>
          <Button variant="outline" className="gap-2" onClick={exportMembers}>
            <Download className="h-4 w-4" /> {t("members.exportExcel")}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{activeCount}</div>
            <p className="text-sm text-muted-foreground">{t("members.activeMemberships")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-destructive">{expiredCount}</div>
            <p className="text-sm text-muted-foreground">{t("members.expiredMemberships")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">{currentYearCount}</div>
            <p className="text-sm text-muted-foreground">{t("members.activeFor")} {currentYear}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            {editingFoundingLimit ? (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={foundingLimitValue}
                  onChange={(e) => setFoundingLimitValue(e.target.value)}
                  className="h-9"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveFoundingLimitMutation.mutate(foundingLimitValue);
                    if (e.key === "Escape") setEditingFoundingLimit(false);
                  }}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => saveFoundingLimitMutation.mutate(foundingLimitValue)}
                  disabled={saveFoundingLimitMutation.isPending}
                >
                  <Save className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div
                className="flex items-center gap-2 cursor-pointer group"
                onClick={() => {
                  setFoundingLimitValue(foundingLimitSetting?.value || "150");
                  setEditingFoundingLimit(true);
                }}
              >
                <div className="text-2xl font-bold text-amber-500">{foundingCount} <span className="text-sm font-normal text-muted-foreground">/ {foundingLimit}</span></div>
                <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            )}
            <p className="text-sm text-muted-foreground mt-1">{t("members.foundingMembers")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            {editingPrice ? (
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Euro className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    value={priceValue}
                    onChange={(e) => setPriceValue(e.target.value)}
                    className="pl-7 h-9"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") savePriceMutation.mutate(priceValue);
                      if (e.key === "Escape") setEditingPrice(false);
                    }}
                  />
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => savePriceMutation.mutate(priceValue)}
                  disabled={savePriceMutation.isPending}
                >
                  <Save className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div
                className="flex items-center gap-2 cursor-pointer group"
                onClick={() => {
                  setPriceValue(membershipPriceSetting?.value || "10");
                  setEditingPrice(true);
                }}
              >
                <div className="text-2xl font-bold">€{membershipPriceSetting?.value || "10"}</div>
                <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            )}
            <p className="text-sm text-muted-foreground mt-1">Quota Tessera</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-600">{incompleteCount}</div>
            <p className="text-sm text-muted-foreground">Dati incompleti</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3 text-2l font-bold">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("members.searchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={segment} onValueChange={(value) => setSegment(value as MemberSegment)}>
              <SelectTrigger className="w-full md:w-[220px]" aria-label="Filtra tesserati">
                <SelectValue placeholder="Segmento tesserati" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti</SelectItem>
                <SelectItem value="active">Tessera attiva</SelectItem>
                <SelectItem value="expired">Tessera scaduta</SelectItem>
                <SelectItem value="currentYear">Attivi {currentYear}</SelectItem>
                <SelectItem value="incomplete">Dati incompleti</SelectItem>
                <SelectItem value="withoutId">Senza ID tessera</SelectItem>
                <SelectItem value="founding">Soci fondatori</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {renderSortableHead("membershipId", t("members.membershipId"), "Ordina tesserati per ID tessera")}
                  {renderSortableHead("name", t("common.name"), "Ordina tesserati per nome")}
                  {renderSortableHead("phone", t("common.phone"), "Ordina tesserati per telefono")}
                  {renderSortableHead("year", t("members.year"), "Ordina tesserati per anno")}
                  {renderSortableHead("completeness", "Dati AICS", "Ordina tesserati per completezza dati AICS")}
                  {renderSortableHead("badges", t("members.badges"), "Ordina tesserati per badge")}
                  {renderSortableHead("accountStatus", t("users.accountStatus"), "Ordina tesserati per stato account")}
                  {renderSortableHead("membershipStatus", t("members.membershipStatus"), "Ordina tesserati per stato tessera")}
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedMembers.map((member) => {
                  const completeness = getCompleteness(member);

                  return (
                    <TableRow key={member.id}>
                      <TableCell className="font-mono">
                        {formatMembershipId(member.membership_id)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {member.first_name} {member.last_name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{member.phone || "—"}</TableCell>
                      <TableCell>{member.membership_year || "—"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={completeness.isComplete ? "outline" : "secondary"}
                          className={
                            completeness.isComplete
                              ? "border-green-500/25 bg-green-500/10 text-green-700"
                              : "border-yellow-500/25 bg-yellow-500/10 text-yellow-700"
                          }
                        >
                          {completeness.percentage}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {(userBadgesMap[member.id] || []).map((b) => (
                            <Badge key={b.badge_id} variant="outline" className="text-xs gap-1">
                              <span>{b.icon}</span> {b.name}
                            </Badge>
                          ))}
                          {!(userBadgesMap[member.id] || []).length && <span className="text-muted-foreground text-sm">—</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={member.account_status === "Active" ? "outline" : "default"}
                          className={
                            member.account_status === "Active" ? "bg-green-500/10 text-green-500 hover:bg-green-500/20" :
                            member.account_status === "Suspended" ? "bg-yellow-500 hover:bg-yellow-600" :
                            "bg-destructive hover:bg-destructive/90"
                          }
                        >
                          {member.account_status || "Active"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={member.membership_status === "Active" ? "default" : "secondary"}
                          className={member.membership_status === "Active" ? "bg-green-500 hover:bg-green-600" : ""}
                        >
                          {member.membership_status}
                        </Badge>
                      </TableCell>
                      <RowActionCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <RowActionButton aria-label="Azioni tesserato">
                              <MoreHorizontal className="h-4 w-4" />
                            </RowActionButton>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setSelectedMember(member)}>
                              <Eye className="h-4 w-4 mr-2" /> Visualizza dati tesseramento
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigate(`/users/${member.id}`)}>
                              <UserRound className="h-4 w-4 mr-2" /> Apri dettaglio utente
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEdit(member)}>
                              <Edit2 className="h-4 w-4 mr-2" /> {t("members.editMembership")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </RowActionCell>
                    </TableRow>
                  );
                })}
                {sortedMembers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      {t("members.noMembersFound")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <PrepaidMembershipImport members={members} />

      <Sheet open={!!selectedMember} onOpenChange={(open) => !open && setSelectedMember(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
          <SheetHeader className="mb-4 pr-8">
            <SheetTitle>Dati tesseramento</SheetTitle>
            <SheetDescription>
              Stato tessera, dati AICS, completezza e pagamenti collegati.
            </SheetDescription>
          </SheetHeader>
          {selectedMember && (
            <MembershipDossier
              profile={selectedMember}
              payments={selectedMemberPayments}
              paymentsLoading={selectedMemberPaymentsLoading}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Edit Membership Dialog */}
      <Dialog open={!!editMember} onOpenChange={(o) => !o && setEditMember(null)}>
        <DialogContent onOpenAutoFocus={(event) => event.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Edit Membership: {editMember?.first_name} {editMember?.last_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="membership_id">Membership ID</Label>
                <Input
                  id="membership_id"
                  type="number"
                  value={editForm.membership_id}
                  onChange={(e) => setEditForm({ ...editForm, membership_id: e.target.value })}
                  placeholder="e.g. 0001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="membership_year">Membership Year</Label>
                <Input
                  id="membership_year"
                  type="number"
                  value={editForm.membership_year}
                  onChange={(e) => setEditForm({ ...editForm, membership_year: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="membership_status">Status</Label>
              <Select
                value={editForm.membership_status}
                onValueChange={(v) => setEditForm({ ...editForm, membership_status: v })}
              >
                <SelectTrigger id="membership_status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Separator />
            <div className="space-y-3">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Shield className="h-4 w-4" /> Founding Member Status
              </Label>
              <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Founding Member</p>
                  <p className="text-xs text-muted-foreground">
                    Grant this user the Founding Member badge and special privileges
                  </p>
                </div>
                <Switch
                  checked={editForm.is_founding_member}
                  onCheckedChange={(checked) => setEditForm({ ...editForm, is_founding_member: checked })}
                />
              </div>
              {editMember && (userBadgesMap[editMember.id] || []).length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <Award className="h-4 w-4" /> Current Badges
                  </Label>
                  <div className="flex gap-1.5 flex-wrap">
                    {(userBadgesMap[editMember.id] || []).map((b) => (
                      <Badge key={b.badge_id} variant="secondary" className="gap-1">
                        <span>{b.icon}</span> {b.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMember(null)}>
              Cancel
            </Button>
            <Button onClick={() => updateMembership.mutate()} disabled={updateMembership.isPending}>
              {updateMembership.isPending ? "Updating..." : "Update Membership"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Expire Dialog */}
      <AlertDialog open={showBulkExpireDialog} onOpenChange={setShowBulkExpireDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Bulk Expire Memberships
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will set all <strong>Active</strong> memberships with a membership year of <strong>{bulkExpireYear} or earlier</strong> to <strong>Expired</strong>. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="bulk_expire_year">Expire memberships for year ≤</Label>
            <Input
              id="bulk_expire_year"
              type="number"
              className="mt-2 max-w-[200px]"
              value={bulkExpireYear}
              onChange={(e) => setBulkExpireYear(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-2">
              Members with membership_year ≤ {bulkExpireYear} and status "Active" will be set to "Expired".
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => bulkExpireMemberships.mutate()}
              disabled={bulkExpireMemberships.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkExpireMemberships.isPending ? "Expiring..." : "Expire Memberships"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Send Renewal Reminders Dialog */}
      <AlertDialog open={showRenewalDialog} onOpenChange={setShowRenewalDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              Send Renewal Reminders
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will send a notification to all members with <strong>Expired</strong> membership status, reminding them to renew their annual membership.
              <br /><br />
              <strong>{members.filter((m) => m.membership_status === "Expired" && m.membership_id).length}</strong> expired member(s) will receive a notification.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => sendRenewalReminders.mutate()}
              disabled={sendRenewalReminders.isPending}
            >
              {sendRenewalReminders.isPending ? "Sending..." : "Send Reminders"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
