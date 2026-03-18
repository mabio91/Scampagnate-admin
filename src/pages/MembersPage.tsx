import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, MoreHorizontal, Edit2, Download, CreditCard, AlertTriangle, Bell, CalendarX } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
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
  });
  const queryClient = useQueryClient();

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

  const updateMembership = useMutation({
    mutationFn: async () => {
      if (!editMember) return;
      const { error } = await supabase
        .from("profiles")
        .update({
          membership_id: editForm.membership_id ? parseInt(editForm.membership_id) : null,
          membership_status: editForm.membership_status,
          membership_year: editForm.membership_year ? parseInt(editForm.membership_year) : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editMember.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Membership updated");
      queryClient.invalidateQueries({ queryKey: ["admin-members"] });
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

  const openEdit = (member: Profile) => {
    setEditMember(member);
    setEditForm({
      membership_id: member.membership_id?.toString() || "",
      membership_status: member.membership_status || "Inactive",
      membership_year: member.membership_year?.toString() || new Date().getFullYear().toString(),
    });
  };

  const filtered = members.filter((m) =>
    `${m.first_name} ${m.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
    m.phone.toLowerCase().includes(search.toLowerCase()) ||
    (m.membership_id?.toString() || "").includes(search)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Membership Management</h1>
          <p className="text-muted-foreground mt-1">View and manage association members ({members.length} total)</p>
        </div>
        <Button className="gap-2" onClick={exportMembers} variant="outline">
          <Download className="h-4 w-4" /> Export CSV
        </Button>
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
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
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
    </div>
  );
}
