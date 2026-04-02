import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, MoreHorizontal, Trash2, Edit2, UserPlus, Download } from "lucide-react";
import RefreshButton from "@/components/RefreshButton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables, Database } from "@/integrations/supabase/types";
import { useLanguage } from "@/i18n/LanguageContext";
import { exportToCsv } from "@/lib/exportUtils";

type Profile = Tables<"profiles">;

export default function UsersPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [segment, setSegment] = useState<string>("all");
  const [editUser, setEditUser] = useState<(Profile & { roles: string[] }) | null>(null);
  const [editForm, setEditForm] = useState({
    first_name: "", last_name: "", phone: "", bio: "",
    account_status: "Active" as Database["public"]["Enums"]["account_status"]
  });
  const [editRole, setEditRole] = useState("user");
  const [createOpen, setCreateOpen] = useState(false);
  const [newUser, setNewUser] = useState({ email: "", password: "", first_name: "", last_name: "", phone: "", role: "user" });
  const [confirmAction, setConfirmAction] = useState<{ type: "delete" | "ban" | "suspend"; userId: string; userName: string } | null>(null);
  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data: profiles, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      let authUsers: { id: string; email: string; last_sign_in_at: string | null; created_at: string }[] = [];
      try {
        const res = await supabase.functions.invoke("list-users");
        if (res.data && !res.data.error) authUsers = res.data;
      } catch {}
      const authMap = new Map(authUsers.map((u) => [u.id, u]));
      return (profiles || []).map((p) => ({
        ...p,
        roles: (roles || []).filter((r) => r.user_id === p.id).map((r) => r.role),
        email: authMap.get(p.id)?.email || p.email || "—",
        last_sign_in_at: authMap.get(p.id)?.last_sign_in_at || null,
      }));
    },
  });

  const { data: regCounts = {} } = useQuery({
    queryKey: ["admin-user-reg-counts"],
    queryFn: async () => {
      const { data } = await supabase.from("event_registrations").select("user_id");
      const counts: Record<string, number> = {};
      data?.forEach((r) => { counts[r.user_id] = (counts[r.user_id] || 0) + 1; });
      return counts;
    },
  });

  const updateProfile = useMutation({
    mutationFn: async () => {
      if (!editUser) return;
      const { error } = await supabase.from("profiles").update({
        first_name: editForm.first_name, last_name: editForm.last_name,
        phone: editForm.phone, bio: editForm.bio, account_status: editForm.account_status,
        updated_at: new Date().toISOString(),
      }).eq("id", editUser.id);
      if (error) throw error;
      const currentRole = editUser.roles.find((r) => ["admin", "organizer", "user"].includes(r)) || "user";
      if (editRole !== currentRole) {
        await supabase.from("user_roles").delete().eq("user_id", editUser.id).eq("role", currentRole as any);
        await supabase.from("user_roles").insert({ user_id: editUser.id, role: editRole as any });
      }
    },
    onSuccess: () => { toast.success("User updated"); queryClient.invalidateQueries({ queryKey: ["admin-users"] }); setEditUser(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: Database["public"]["Enums"]["account_status"] }) => {
      const { error } = await supabase.from("profiles").update({ account_status: status, updated_at: new Date().toISOString() }).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("User status updated"); queryClient.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteUser = useMutation({
    mutationFn: async (userId: string) => {
      const res = await supabase.functions.invoke("delete-user", { body: { user_id: userId } });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
    },
    onSuccess: () => { toast.success("User deleted successfully"); queryClient.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const createUser = useMutation({
    mutationFn: async () => {
      const res = await supabase.functions.invoke("create-user", { body: newUser });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
    },
    onSuccess: () => {
      toast.success("User created successfully");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setCreateOpen(false);
      setNewUser({ email: "", password: "", first_name: "", last_name: "", phone: "", role: "user" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (user: Profile & { roles: string[] }) => {
    setEditUser(user);
    setEditForm({ first_name: user.first_name, last_name: user.last_name, phone: user.phone, bio: user.bio || "", account_status: user.account_status || "Active" });
    setEditRole(user.roles.includes("admin") ? "admin" : user.roles.includes("organizer") ? "organizer" : "user");
  };

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const filtered = users.filter((u) => {
    const searchLower = search.toLowerCase();
    const matchesSearch =
      `${u.first_name} ${u.last_name}`.toLowerCase().includes(searchLower) ||
      (u.phone || "").toLowerCase().includes(searchLower) ||
      (u.email || "").toLowerCase().includes(searchLower) ||
      (u.membership_id ? String(u.membership_id).toLowerCase().includes(searchLower) : false);
    const matchesStatus = statusFilter === "All" || u.account_status === statusFilter;

    // Segment filtering
    let matchesSegment = true;
    const eventCount = regCounts[u.id] || 0;
    if (segment === "new") {
      matchesSegment = new Date(u.created_at) >= thirtyDaysAgo;
    } else if (segment === "active") {
      matchesSegment = eventCount > 0 && u.last_sign_in_at != null && new Date(u.last_sign_in_at) >= ninetyDaysAgo;
    } else if (segment === "inactive") {
      matchesSegment = u.last_sign_in_at == null || new Date(u.last_sign_in_at) < ninetyDaysAgo;
    } else if (segment === "incomplete_onboarding") {
      matchesSegment = !u.onboarding_completed;
    } else if (segment === "no_participation") {
      matchesSegment = eventCount === 0;
    } else if (segment === "high_participation") {
      matchesSegment = eventCount >= 5;
    }

    return matchesSearch && matchesStatus && matchesSegment;
  });

  const handleExport = () => {
    exportToCsv("users", [t("common.name"), t("common.email"), t("common.phone"), t("users.role"), t("common.status"), t("users.events"), t("users.joined")],
      filtered.map((u) => [
        `${u.first_name} ${u.last_name}`, u.email || "", u.phone || "",
        u.roles.join(", "), u.account_status || "Active",
        String(regCounts[u.id] || 0), new Date(u.created_at).toLocaleDateString(),
      ])
    );
    toast.success(t("export.exportCsv"));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">{t("users.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("users.subtitle")} ({users.length} {t("common.total").toLowerCase()})</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <RefreshButton queryKeys={[["admin-users"], ["admin-user-reg-counts"]]} />
          <Button variant="outline" size="icon" onClick={handleExport} title={t("export.exportCsv")}>
            <Download className="h-4 w-4" />
          </Button>
          <Button className="gap-2 flex-1 sm:flex-initial" onClick={() => setCreateOpen(true)}>
            <UserPlus className="h-4 w-4" /> {t("users.addUser")}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3 space-y-3">
          <div className="flex flex-wrap gap-4">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder={t("users.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <div className="w-[180px]">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue placeholder={t("users.filterByStatus")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">{t("users.allStatuses")}</SelectItem>
                  <SelectItem value="Active">{t("common.active")}</SelectItem>
                  <SelectItem value="Suspended">{t("users.suspended")}</SelectItem>
                  <SelectItem value="Banned">{t("users.banned")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {([
              { key: "all", label: t("segments.all") },
              { key: "new", label: t("segments.newUsers") },
              { key: "active", label: t("segments.activeUsers") },
              { key: "inactive", label: t("segments.inactiveUsers") },
              { key: "incomplete_onboarding", label: t("segments.incompleteOnboarding") },
              { key: "no_participation", label: t("segments.noParticipation") },
              { key: "high_participation", label: t("segments.highParticipation") },
            ] as const).map((seg) => (
              <Badge
                key={seg.key}
                variant={segment === seg.key ? "default" : "outline"}
                className={`cursor-pointer text-xs px-3 py-1 transition-colors ${segment === seg.key ? "" : "hover:bg-accent"}`}
                onClick={() => setSegment(seg.key)}
              >
                {seg.label}
              </Badge>
            ))}
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.name")}</TableHead>
                  <TableHead>{t("common.email")}</TableHead>
                  <TableHead>{t("common.phone")}</TableHead>
                  <TableHead>{t("users.role")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead>{t("users.events")}</TableHead>
                  <TableHead>{t("users.joined")}</TableHead>
                  <TableHead>{t("users.lastLogin")}</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((user) => (
                  <TableRow key={user.id} className="cursor-pointer" onClick={() => navigate(`/users/${user.id}`)}>
                    <TableCell className="font-medium">{user.first_name} {user.last_name}</TableCell>
                    <TableCell className="text-muted-foreground">{user.email || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{user.phone || "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {user.roles.map((r) => (
                          <Badge key={r} variant={r === "admin" ? "default" : r === "organizer" ? "secondary" : "outline"}>{r}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={user.account_status === "Active" ? "outline" : "default"}
                        className={
                          user.account_status === "Active" ? "bg-green-500/10 text-green-500 hover:bg-green-500/20" :
                          user.account_status === "Suspended" ? "bg-yellow-500 hover:bg-yellow-600" :
                          "bg-destructive hover:bg-destructive/90"
                        }
                      >
                        {user.account_status || "Active"}
                      </Badge>
                    </TableCell>
                    <TableCell>{regCounts[user.id] || 0}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{new Date(user.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : t("users.never")}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/users/${user.id}`)}>
                            <Search className="h-4 w-4 mr-2" /> {t("users.viewDetails")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(user)}>
                            <Edit2 className="h-4 w-4 mr-2" /> {t("users.editDetails")}
                          </DropdownMenuItem>
                          {user.account_status !== "Suspended" && (
                            <DropdownMenuItem onClick={() => setConfirmAction({ type: "suspend", userId: user.id, userName: `${user.first_name} ${user.last_name}` })}>
                              <MoreHorizontal className="h-4 w-4 mr-2" /> Suspend Account
                            </DropdownMenuItem>
                          )}
                          {user.account_status === "Suspended" && (
                            <DropdownMenuItem onClick={() => updateStatus.mutate({ userId: user.id, status: "Active" })}>
                              <Edit2 className="h-4 w-4 mr-2" /> Reactivate Account
                            </DropdownMenuItem>
                          )}
                          {user.account_status !== "Banned" && (
                            <DropdownMenuItem className="text-destructive" onClick={() => setConfirmAction({ type: "ban", userId: user.id, userName: `${user.first_name} ${user.last_name}` })}>
                              <Trash2 className="h-4 w-4 mr-2" /> Ban User
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem className="text-destructive" onClick={() => setConfirmAction({ type: "delete", userId: user.id, userName: `${user.first_name} ${user.last_name}` })}>
                            <Trash2 className="h-4 w-4 mr-2" /> Delete Profile
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">{t("users.noUsersFound")}</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editUser} onOpenChange={(o) => !o && setEditUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit User</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>First Name</Label><Input value={editForm.first_name} onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })} /></div>
              <div><Label>Last Name</Label><Input value={editForm.last_name} onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })} /></div>
            </div>
            <div><Label>Phone</Label><Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} /></div>
            <div><Label>Bio</Label><Input value={editForm.bio} onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })} /></div>
            <div>
              <Label>Role</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="organizer">Organizer</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Account Status</Label>
              <Select value={editForm.account_status || "Active"} onValueChange={(v: any) => setEditForm({ ...editForm, account_status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Suspended">Suspended</SelectItem>
                  <SelectItem value="Banned">Banned</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
            <Button onClick={() => updateProfile.mutate()} disabled={updateProfile.isPending}>
              {updateProfile.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create User Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create New User</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>First Name</Label><Input value={newUser.first_name} onChange={(e) => setNewUser({ ...newUser, first_name: e.target.value })} /></div>
              <div><Label>Last Name</Label><Input value={newUser.last_name} onChange={(e) => setNewUser({ ...newUser, last_name: e.target.value })} /></div>
            </div>
            <div><Label>Email *</Label><Input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} placeholder="user@example.com" /></div>
            <div><Label>Password *</Label><Input type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} placeholder="Min 6 characters" /></div>
            <div><Label>Phone</Label><Input value={newUser.phone} onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })} /></div>
            <div>
              <Label>Role</Label>
              <Select value={newUser.role} onValueChange={(v) => setNewUser({ ...newUser, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="organizer">Organizer</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createUser.mutate()} disabled={createUser.isPending || !newUser.email || !newUser.password}>
              {createUser.isPending ? "Creating..." : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={(o) => !o && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === "delete" ? "Delete User" : confirmAction?.type === "ban" ? "Ban User" : "Suspend User"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === "delete"
                ? `This will permanently delete ${confirmAction.userName}'s profile and all associated data. This action cannot be undone.`
                : confirmAction?.type === "ban"
                ? `Are you sure you want to ban ${confirmAction?.userName}? They will lose access to the platform.`
                : `Are you sure you want to suspend ${confirmAction?.userName}'s account?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!confirmAction) return;
                if (confirmAction.type === "delete") deleteUser.mutate(confirmAction.userId);
                else if (confirmAction.type === "ban") updateStatus.mutate({ userId: confirmAction.userId, status: "Banned" });
                else updateStatus.mutate({ userId: confirmAction.userId, status: "Suspended" });
                setConfirmAction(null);
              }}
            >
              {confirmAction?.type === "delete" ? "Delete" : confirmAction?.type === "ban" ? "Ban" : "Suspend"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
