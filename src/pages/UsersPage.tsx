import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, MoreHorizontal, Trash2, Edit2, UserPlus } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables, Database } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [viewUser, setViewUser] = useState<(Profile & { roles: string[] }) | null>(null);
  const [editUser, setEditUser] = useState<(Profile & { roles: string[] }) | null>(null);
  const [editForm, setEditForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    bio: "",
    account_status: "Active" as Database["public"]["Enums"]["account_status"]
  });
  const [editRole, setEditRole] = useState("user");
  const [createOpen, setCreateOpen] = useState(false);
  const [newUser, setNewUser] = useState({ email: "", password: "", first_name: "", last_name: "", phone: "", role: "user" });
  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data: profiles, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");

      // Fetch auth user data (email, last_sign_in_at)
      let authUsers: { id: string; email: string; last_sign_in_at: string | null; created_at: string }[] = [];
      try {
        const res = await supabase.functions.invoke("list-users");
        if (res.data && !res.data.error) authUsers = res.data;
      } catch { }

      const authMap = new Map(authUsers.map((u) => [u.id, u]));

      return (profiles || []).map((p) => ({
        ...p,
        roles: (roles || []).filter((r) => r.user_id === p.id).map((r) => r.role),
        email: authMap.get(p.id)?.email || "—",
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

  const { data: userActivity, isLoading: loadingActivity } = useQuery({
    queryKey: ["admin-user-activity", viewUser?.id],
    queryFn: async () => {
      if (!viewUser?.id) return [];
      const { data, error } = await supabase
        .from("event_registrations")
        .select(`
          id,
          status,
          checked_in,
          created_at,
          events:event_id (
            id,
            title,
            date
          )
        `)
        .eq("user_id", viewUser.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!viewUser?.id,
  });

  const updateProfile = useMutation({
    mutationFn: async () => {
      if (!editUser) return;
      const { error } = await supabase.from("profiles").update({
        first_name: editForm.first_name,
        last_name: editForm.last_name,
        phone: editForm.phone,
        bio: editForm.bio,
        account_status: editForm.account_status,
        updated_at: new Date().toISOString(),
      }).eq("id", editUser.id);
      if (error) throw error;

      // Update role
      const currentRole = editUser.roles.find((r) => ["admin", "organizer", "user"].includes(r)) || "user";
      if (editRole !== currentRole) {
        await supabase.from("user_roles").delete().eq("user_id", editUser.id).eq("role", currentRole as any);
        await supabase.from("user_roles").insert({ user_id: editUser.id, role: editRole as any });
      }
    },
    onSuccess: () => {
      toast.success("User updated");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setEditUser(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: Database["public"]["Enums"]["account_status"] }) => {
      const { error } = await supabase.from("profiles").update({
        account_status: status,
        updated_at: new Date().toISOString(),
      }).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("User status updated");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteUser = useMutation({
    mutationFn: async (userId: string) => {
      const res = await supabase.functions.invoke("delete-user", {
        body: { user_id: userId },
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
    },
    onSuccess: () => {
      toast.success("User deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const createUser = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("create-user", {
        body: newUser,
      });
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
    setEditForm({
      first_name: user.first_name,
      last_name: user.last_name,
      phone: user.phone,
      bio: user.bio || "",
      account_status: user.account_status || "Active"
    });
    setEditRole(user.roles.includes("admin") ? "admin" : user.roles.includes("organizer") ? "organizer" : "user");
  };

  const filtered = users.filter((u) => {
    const searchLower = search.toLowerCase();
    const matchesSearch = 
      `${u.first_name} ${u.last_name}`.toLowerCase().includes(searchLower) ||
      (u.phone || "").toLowerCase().includes(searchLower) ||
      (u.email || "").toLowerCase().includes(searchLower) ||
      (u.membership_id ? String(u.membership_id).toLowerCase().includes(searchLower) : false);
      
    const matchesStatus = statusFilter === "All" || u.account_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Users</h1>
          <p className="text-muted-foreground mt-1">Manage platform users ({users.length} total)</p>
        </div>
        <Button className="gap-2" onClick={() => setCreateOpen(true)}>
          <UserPlus className="h-4 w-4" /> Add User
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap gap-4">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by name, email, phone, or member ID..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <div className="w-[180px]">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Statuses</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Suspended">Suspended</SelectItem>
                  <SelectItem value="Banned">Banned</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Events</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((user) => (
                  <TableRow key={user.id}>
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
                    <TableCell className="text-muted-foreground text-sm">{user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : "Never"}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setViewUser(user)}>
                            <Search className="h-4 w-4 mr-2" /> View Details & Activity
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(user)}>
                            <Edit2 className="h-4 w-4 mr-2" /> Edit Details
                          </DropdownMenuItem>
                          {user.account_status !== "Suspended" && (
                            <DropdownMenuItem onClick={() => updateStatus.mutate({ userId: user.id, status: "Suspended" })}>
                              <MoreHorizontal className="h-4 w-4 mr-2" /> Suspend Account
                            </DropdownMenuItem>
                          )}
                          {user.account_status === "Suspended" && (
                            <DropdownMenuItem onClick={() => updateStatus.mutate({ userId: user.id, status: "Active" })}>
                              <Edit2 className="h-4 w-4 mr-2" /> Reactivate Account
                            </DropdownMenuItem>
                          )}
                          {user.account_status !== "Banned" && (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => { if (confirm("Are you sure you want to BAN this user? This is permanent.")) updateStatus.mutate({ userId: user.id, status: "Banned" }); }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" /> Ban User
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem className="text-destructive" onClick={() => { if (confirm("Delete this user's profile entirely?")) deleteUser.mutate(user.id); }}>
                            <Trash2 className="h-4 w-4 mr-2" /> Delete Profile
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No users found</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* View User Activity Dialog */}
      <Dialog open={!!viewUser} onOpenChange={(o) => !o && setViewUser(null)}>
        <DialogContent className="max-w-3xl h-[80vh] flex flex-col pl-6 pr-2">
          <DialogHeader className="pr-4">
            <DialogTitle>User Details: {viewUser?.first_name} {viewUser?.last_name}</DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-4">
            {viewUser && (
              <Tabs defaultValue="profile" className="w-full mt-2">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="profile">Profile Overview</TabsTrigger>
                  <TabsTrigger value="activity">Activity History</TabsTrigger>
                </TabsList>

                <TabsContent value="profile" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="font-medium">{viewUser.email || "—"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Phone</p>
                      <p className="font-medium">{viewUser.phone || "—"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Joined Date</p>
                      <p className="font-medium">{new Date(viewUser.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Account Status</p>
                      <Badge variant={viewUser.account_status === "Active" ? "outline" : "default"}>
                        {viewUser.account_status || "Active"}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Roles</p>
                      <div className="flex gap-1 flex-wrap">
                        {viewUser.roles.map((r) => <Badge key={r} variant="secondary">{r}</Badge>)}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Membership Status</p>
                      <Badge variant={viewUser.membership_status === "Active" ? "outline" : "secondary"}>
                        {viewUser.membership_status || "None"}
                      </Badge>
                    </div>
                    {viewUser.membership_id && (
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Membership ID</p>
                        <p className="font-medium font-mono text-sm">{viewUser.membership_id}</p>
                      </div>
                    )}
                  </div>

                  {viewUser.bio && (
                    <div className="space-y-1 mt-4">
                      <p className="text-sm text-muted-foreground">Bio</p>
                      <p className="text-sm whitespace-pre-wrap bg-muted/30 p-3 rounded-md border">{viewUser.bio}</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="activity" className="space-y-4 mt-4">
                  <div className="grid grid-cols-4 gap-4 mb-4">
                    <Card className="bg-primary/5 border-primary/20">
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-primary">{userActivity?.filter(a => a.status === 'registered' || a.status === 'paid').length || 0}</div>
                        <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Joined</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-success/5 border-success/20">
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-success">{userActivity?.filter(a => a.checked_in).length || 0}</div>
                        <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Attended</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-warning/5 border-warning/20">
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-warning">{userActivity?.filter(a => a.status === 'waitlist').length || 0}</div>
                        <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Waitlist</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-destructive/5 border-destructive/20">
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-destructive">{userActivity?.filter(a => a.status === 'cancelled').length || 0}</div>
                        <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Cancelled</div>
                      </CardContent>
                    </Card>
                  </div>

                  {loadingActivity ? (
                    <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
                  ) : !userActivity || userActivity.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground border rounded-lg bg-muted/10">
                      No event activity found for this user.
                    </div>
                  ) : (
                    <div className="border rounded-md">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Event</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Attendance</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {userActivity.map((activity: any) => {
                            const eventDateStr = activity.events?.date;
                            const isPast = eventDateStr ? new Date(eventDateStr) < new Date(new Date().setHours(0, 0, 0, 0)) : false;
                            const isNoShow = isPast && !activity.checked_in && (activity.status === 'registered' || activity.status === 'paid');

                            return (
                              <TableRow key={activity.id}>
                                <TableCell className="font-medium">{activity.events?.title || "Unknown Event"}</TableCell>
                                <TableCell className="text-muted-foreground">{eventDateStr ? new Date(eventDateStr).toLocaleDateString() : "—"}</TableCell>
                                <TableCell>
                                  <Badge variant={
                                    activity.status === 'registered' || activity.status === 'paid' ? 'default' :
                                      activity.status === 'waitlist' ? 'secondary' : 'outline'
                                  }>
                                    {activity.status}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {activity.checked_in ? (
                                    <Badge variant="outline" className="bg-success/10 text-success border-success/30">Present</Badge>
                                  ) : isNoShow ? (
                                    <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">No Show</Badge>
                                  ) : (
                                    <span className="text-muted-foreground text-sm">—</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

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
              <Select
                value={editForm.account_status || "Active"}
                onValueChange={(v: any) => setEditForm({ ...editForm, account_status: v })}
              >
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
    </div>
  );
}
