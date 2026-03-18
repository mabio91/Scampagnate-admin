import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, MoreHorizontal, Plus, Trash2, Edit2 } from "lucide-react";
import RefreshButton from "@/components/RefreshButton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";

export default function OrganizersPage() {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [editOrg, setEditOrg] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ first_name: "", last_name: "", phone: "", bio: "" });
  const queryClient = useQueryClient();

  const { data: organizers = [], isLoading } = useQuery({
    queryKey: ["admin-organizers"],
    queryFn: async () => {
      const { data: orgRoles } = await supabase.from("user_roles").select("user_id").eq("role", "organizer");
      if (!orgRoles?.length) return [];
      const orgIds = orgRoles.map((r) => r.user_id);
      const { data: profiles } = await supabase.from("profiles").select("*").in("id", orgIds);
      const { data: events } = await supabase.from("events").select("organizer_id");
      return (profiles || []).map((p) => ({
        ...p,
        eventCount: events?.filter((e) => e.organizer_id === p.id).length || 0,
      }));
    },
  });

  const updateOrg = useMutation({
    mutationFn: async () => {
      if (!editOrg) return;
      const { error } = await supabase.from("profiles").update({
        first_name: editForm.first_name,
        last_name: editForm.last_name,
        phone: editForm.phone,
        bio: editForm.bio,
        updated_at: new Date().toISOString(),
      }).eq("id", editOrg.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Organizer updated");
      queryClient.invalidateQueries({ queryKey: ["admin-organizers"] });
      setEditOrg(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeOrgRole = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "organizer" as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Organizer role removed");
      queryClient.invalidateQueries({ queryKey: ["admin-organizers"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (org: any) => {
    setEditOrg(org);
    setEditForm({ first_name: org.first_name, last_name: org.last_name, phone: org.phone, bio: org.bio || "" });
  };

  const filtered = organizers.filter((o) =>
    `${o.first_name} ${o.last_name}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">{t("organizers.title")}</h1>
        <p className="text-muted-foreground mt-1">{t("organizers.subtitle")} ({organizers.length} {t("common.total").toLowerCase()})</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder={t("common.search") + "..."} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.name")}</TableHead>
                  <TableHead>{t("common.phone")}</TableHead>
                  <TableHead>{t("users.events")}</TableHead>
                  <TableHead>{t("users.joined")}</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((org) => (
                  <TableRow key={org.id}>
                    <TableCell className="font-medium">{org.first_name} {org.last_name}</TableCell>
                    <TableCell className="text-muted-foreground">{org.phone || "—"}</TableCell>
                    <TableCell>{org.eventCount}</TableCell>
                    <TableCell className="text-muted-foreground">{new Date(org.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(org)}>
                            <Edit2 className="h-4 w-4 mr-2" /> {t("common.edit")}
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => { if (confirm(t("organizers.removeConfirm"))) removeOrgRole.mutate(org.id); }}>
                            <Trash2 className="h-4 w-4 mr-2" /> {t("organizers.removeRole")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">{t("organizers.noOrganizers")}</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editOrg} onOpenChange={(o) => !o && setEditOrg(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("organizers.editOrganizer")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>{t("users.firstName")}</Label><Input value={editForm.first_name} onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })} /></div>
              <div><Label>{t("users.lastName")}</Label><Input value={editForm.last_name} onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })} /></div>
            </div>
            <div><Label>{t("common.phone")}</Label><Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} /></div>
            <div><Label>Bio</Label><Input value={editForm.bio} onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOrg(null)}>{t("common.cancel")}</Button>
            <Button onClick={() => updateOrg.mutate()} disabled={updateOrg.isPending}>
              {updateOrg.isPending ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
