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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [editUser, setEditUser] = useState<(Profile & { roles: string[] }) | null>(null);
  const [editForm, setEditForm] = useState({ first_name: "", last_name: "", phone: "", bio: "" });
  const [editRole, setEditRole] = useState("user");
  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data: profiles, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      return (profiles || []).map((p) => ({
        ...p,
        roles: (roles || []).filter((r) => r.user_id === p.id).map((r) => r.role),
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
        first_name: editForm.first_name,
        last_name: editForm.last_name,
        phone: editForm.phone,
        bio: editForm.bio,
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

  const deleteUser = useMutation({
    mutationFn: async (userId: string) => {
      // Delete roles, then profile (cascade should handle, but be explicit)
      await supabase.from("user_roles").delete().eq("user_id", userId);
      const { error } = await supabase.from("profiles").delete().eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("User removed");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (user: Profile & { roles: string[] }) => {
    setEditUser(user);
    setEditForm({ first_name: user.first_name, last_name: user.last_name, phone: user.phone, bio: user.bio || "" });
    setEditRole(user.roles.includes("admin") ? "admin" : user.roles.includes("organizer") ? "organizer" : "user");
  };

  const filtered = users.filter((u) =>
    `${u.first_name} ${u.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
    u.phone.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Users</h1>
        <p className="text-muted-foreground mt-1">Manage platform users ({users.length} total)</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
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
                  <TableHead>Phone</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Events</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.first_name} {user.last_name}</TableCell>
                    <TableCell className="text-muted-foreground">{user.phone || "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {user.roles.map((r) => (
                          <Badge key={r} variant={r === "admin" ? "default" : r === "organizer" ? "secondary" : "outline"}>{r}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{regCounts[user.id] || 0}</TableCell>
                    <TableCell className="text-muted-foreground">{new Date(user.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(user)}>
                            <Edit2 className="h-4 w-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => { if (confirm("Delete this user?")) deleteUser.mutate(user.id); }}>
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No users found</TableCell></TableRow>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
            <Button onClick={() => updateProfile.mutate()} disabled={updateProfile.isPending}>
              {updateProfile.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
