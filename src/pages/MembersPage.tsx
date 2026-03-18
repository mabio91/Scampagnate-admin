import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, MoreHorizontal, Edit2, Download, CreditCard, AlertTriangle, Bell, CalendarX, Award, Shield } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;

export default function MembersPage() {
  const [search, setSearch] = useState("");
  const [editMember, setEditMember] = useState<Profile | null>(null);
  const [editForm, setEditForm] = useState({
    membership_id: "",
    membership_status: "Inactive",
    membership_year: new Date().getFullYear().toString(),
    is_founding_member: false,
  });
  const [showBulkExpireDialog, setShowBulkExpireDialog] = useState(false);
  const [bulkExpireYear, setBulkExpireYear] = useState((new Date().getFullYear() - 1).toString());
  const [showRenewalDialog, setShowRenewalDialog] = useState(false);
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
      (data || []).forEach((ub: any) => {
        if (!map[ub.user_id]) map[ub.user_id] = [];
        map[ub.user_id].push({ badge_id: ub.badge_id, name: ub.badges?.name || "", icon: ub.badges?.icon || "" });
      });
      return map;
    },
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
      const foundingBadge = allBadges.find(b => b.name === "Founding Member");
      if (foundingBadge) {
        const hasBadge = (userBadgesMap[editMember.id] || []).some(b => b.name === "Founding Member");
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
    onError: (e: any) => toast.error(e.message),
  });

  const exportMembers = () => {
    const headers = ["Name", "Email", "Phone", "Membership ID", "Year", "Status"];
    const csvData = members.map((m) => [
      `${m.first_name} ${m.last_name}`,
      "", // Email is not in profiles table, would need a join or fetch if needed
      m.phone,
      m.membership_id || "",
      m.membership_year || "",
      m.membership_status || "Inactive",
    ]);

    const csvContent = [headers, ...csvData].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `members_export_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
    onError: (e: any) => toast.error(e.message),
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
    onError: (e: any) => toast.error(e.message),
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

  const filtered = members.filter((m) =>
    `${m.first_name} ${m.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
    m.phone.toLowerCase().includes(search.toLowerCase()) ||
    (m.membership_id?.toString() || "").includes(search)
  );

  const activeCount = members.filter((m) => m.membership_status === "Active").length;
  const expiredCount = members.filter((m) => m.membership_status === "Expired").length;
  const currentYearCount = members.filter((m) => m.membership_year === currentYear && m.membership_status === "Active").length;
  const foundingCount = members.filter((m) => m.is_founding_member).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Membership Management</h1>
          <p className="text-muted-foreground mt-1">View and manage association members ({members.length} total)</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="destructive" className="gap-2" onClick={() => setShowBulkExpireDialog(true)}>
            <CalendarX className="h-4 w-4" /> Bulk Expire
          </Button>
          <Button variant="secondary" className="gap-2" onClick={() => setShowRenewalDialog(true)}>
            <Bell className="h-4 w-4" /> Send Renewal Reminders
          </Button>
          <Button variant="outline" className="gap-2" onClick={exportMembers}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{activeCount}</div>
            <p className="text-sm text-muted-foreground">Active Memberships</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-destructive">{expiredCount}</div>
            <p className="text-sm text-muted-foreground">Expired Memberships</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">{currentYearCount}</div>
            <p className="text-sm text-muted-foreground">Active for {currentYear}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-amber-500">{foundingCount} <span className="text-sm font-normal text-muted-foreground">/ 150</span></div>
            <p className="text-sm text-muted-foreground">Founding Members</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3 text-2l font-bold">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search members by name, phone or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
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
                  <TableHead>Membership ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead>Badges</TableHead>
                  <TableHead>Account Status</TableHead>
                  <TableHead>Membership Status</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-mono">
                      {member.membership_id ? member.membership_id.toString().padStart(4, "0") : "—"}
                    </TableCell>
                    <TableCell className="font-medium">
                      {member.first_name} {member.last_name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{member.phone || "—"}</TableCell>
                    <TableCell>{member.membership_year || "—"}</TableCell>
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
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(member)}>
                            <Edit2 className="h-4 w-4 mr-2" /> Edit Membership
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No members found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Membership Dialog */}
      <Dialog open={!!editMember} onOpenChange={(o) => !o && setEditMember(null)}>
        <DialogContent>
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
