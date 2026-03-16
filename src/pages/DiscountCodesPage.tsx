import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, TicketPercent, Copy, Eye } from "lucide-react";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

type DiscountCode = Tables<"discount_codes">;

const DiscountCodesPage = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [usageDialogOpen, setUsageDialogOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<DiscountCode | null>(null);
  const [selectedCodeId, setSelectedCodeId] = useState<string | null>(null);

  const [form, setForm] = useState({
    code: "",
    description: "",
    discount_type: "percentage" as string,
    discount_value: 0,
    applies_to_all: true,
    event_ids: [] as string[],
    max_uses: null as number | null,
    expires_at: "",
    is_active: true,
  });

  const { data: codes = [], isLoading } = useQuery({
    queryKey: ["discount-codes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("discount_codes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as DiscountCode[];
    },
  });

  const { data: events = [] } = useQuery({
    queryKey: ["events-for-discount"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, title")
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: usageData = [] } = useQuery({
    queryKey: ["discount-usage", selectedCodeId],
    enabled: !!selectedCodeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("discount_code_usage")
        .select("*, profiles:user_id(first_name, last_name, email), events:event_id(title)")
        .eq("discount_code_id", selectedCodeId!);
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: typeof form) => {
      const payload: any = {
        code: values.code.toUpperCase().trim(),
        description: values.description,
        discount_type: values.discount_type,
        discount_value: values.discount_value,
        applies_to_all: values.applies_to_all,
        event_ids: values.applies_to_all ? null : values.event_ids,
        max_uses: values.max_uses,
        expires_at: values.expires_at || null,
        is_active: values.is_active,
      };

      if (editingCode) {
        const { error } = await supabase
          .from("discount_codes")
          .update(payload)
          .eq("id", editingCode.id);
        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        payload.created_by = user?.id;
        const { error } = await supabase.from("discount_codes").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discount-codes"] });
      toast({ title: editingCode ? "Discount code updated" : "Discount code created" });
      closeDialog();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("discount_codes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discount-codes"] });
      toast({ title: "Discount code deleted" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("discount_codes").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discount-codes"] });
    },
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingCode(null);
    setForm({
      code: "", description: "", discount_type: "percentage", discount_value: 0,
      applies_to_all: true, event_ids: [], max_uses: null, expires_at: "", is_active: true,
    });
  };

  const openEdit = (code: DiscountCode) => {
    setEditingCode(code);
    setForm({
      code: code.code,
      description: code.description,
      discount_type: code.discount_type,
      discount_value: code.discount_value,
      applies_to_all: code.applies_to_all,
      event_ids: (code.event_ids as string[]) || [],
      max_uses: code.max_uses,
      expires_at: code.expires_at ? code.expires_at.split("T")[0] : "",
      is_active: code.is_active,
    });
    setDialogOpen(true);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Code copied to clipboard" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Discount Codes</h1>
          <p className="text-muted-foreground">Manage promotional discount codes for events</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Create Code
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-foreground">{codes.length}</div>
            <p className="text-xs text-muted-foreground">Total Codes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{codes.filter(c => c.is_active).length}</div>
            <p className="text-xs text-muted-foreground">Active Codes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-foreground">{codes.reduce((s, c) => s + c.times_used, 0)}</div>
            <p className="text-xs text-muted-foreground">Total Uses</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-foreground">
              {codes.filter(c => c.expires_at && new Date(c.expires_at) < new Date()).length}
            </div>
            <p className="text-xs text-muted-foreground">Expired Codes</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TicketPercent className="h-5 w-5" /> All Discount Codes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : codes.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No discount codes yet. Create one to get started.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Uses</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {codes.map((code) => {
                  const isExpired = code.expires_at && new Date(code.expires_at) < new Date();
                  const isMaxed = code.max_uses && code.times_used >= code.max_uses;
                  return (
                    <TableRow key={code.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="font-mono font-bold text-foreground bg-muted px-2 py-1 rounded text-sm">
                            {code.code}
                          </code>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyCode(code.code)}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[200px] truncate">{code.description}</TableCell>
                      <TableCell className="font-semibold text-foreground">
                        {code.discount_type === "percentage" ? `${code.discount_value}%` : `€${code.discount_value}`}
                      </TableCell>
                      <TableCell>
                        <Badge variant={code.applies_to_all ? "default" : "secondary"}>
                          {code.applies_to_all ? "All Events" : `${(code.event_ids as string[])?.length || 0} events`}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {code.times_used}{code.max_uses ? ` / ${code.max_uses}` : ""}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {code.expires_at ? new Date(code.expires_at).toLocaleDateString() : "Never"}
                      </TableCell>
                      <TableCell>
                        {isExpired ? (
                          <Badge variant="outline" className="text-muted-foreground">Expired</Badge>
                        ) : isMaxed ? (
                          <Badge variant="outline" className="text-muted-foreground">Exhausted</Badge>
                        ) : (
                          <Switch
                            checked={code.is_active}
                            onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: code.id, is_active: checked })}
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => { setSelectedCodeId(code.id); setUsageDialogOpen(true); }}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(code)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteMutation.mutate(code.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCode ? "Edit Discount Code" : "Create Discount Code"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Code</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="e.g. SCAMPAGNA10"
                className="font-mono"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Promotional campaign description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Discount Type</Label>
                <Select value={form.discount_type} onValueChange={(v) => setForm({ ...form, discount_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Fixed Amount (€)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Value</Label>
                <Input
                  type="number"
                  value={form.discount_value}
                  onChange={(e) => setForm({ ...form, discount_value: parseFloat(e.target.value) || 0 })}
                  min={0}
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.applies_to_all}
                onCheckedChange={(checked) => setForm({ ...form, applies_to_all: checked, event_ids: checked ? [] : form.event_ids })}
              />
              <Label>Apply to all events</Label>
            </div>
            {!form.applies_to_all && (
              <div>
                <Label>Select Events</Label>
                <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
                  {events.map((ev) => (
                    <label key={ev.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.event_ids.includes(ev.id)}
                        onChange={(e) => {
                          setForm({
                            ...form,
                            event_ids: e.target.checked
                              ? [...form.event_ids, ev.id]
                              : form.event_ids.filter((id) => id !== ev.id),
                          });
                        }}
                      />
                      <span className="text-foreground">{ev.title}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Max Uses (optional)</Label>
                <Input
                  type="number"
                  value={form.max_uses ?? ""}
                  onChange={(e) => setForm({ ...form, max_uses: e.target.value ? parseInt(e.target.value) : null })}
                  placeholder="Unlimited"
                  min={1}
                />
              </div>
              <div>
                <Label>Expires At (optional)</Label>
                <Input
                  type="date"
                  value={form.expires_at}
                  onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.is_active}
                onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
              />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate(form)} disabled={!form.code || form.discount_value <= 0}>
              {editingCode ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Usage Dialog */}
      <Dialog open={usageDialogOpen} onOpenChange={setUsageDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Code Usage History</DialogTitle>
          </DialogHeader>
          {usageData.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No usage recorded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Original</TableHead>
                  <TableHead>Final</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usageData.map((u: any) => (
                  <TableRow key={u.id}>
                    <TableCell>{u.profiles?.first_name} {u.profiles?.last_name}</TableCell>
                    <TableCell className="max-w-[120px] truncate">{u.events?.title}</TableCell>
                    <TableCell>€{u.original_price}</TableCell>
                    <TableCell className="text-green-600 font-semibold">€{u.discounted_price}</TableCell>
                    <TableCell className="text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DiscountCodesPage;
