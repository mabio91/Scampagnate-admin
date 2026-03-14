import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Package, GripVertical, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TemplateItem {
  id?: string;
  name: string;
  is_mandatory: boolean;
  notes: string | null;
  sort_order: number;
}

export default function EquipmentTemplatesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [items, setItems] = useState<TemplateItem[]>([]);
  const [newItemName, setNewItemName] = useState("");
  const [newItemMandatory, setNewItemMandatory] = useState(false);
  const [newItemNotes, setNewItemNotes] = useState("");

  const { data: templates, isLoading } = useQuery({
    queryKey: ["equipment-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipment_templates")
        .select("*, event_categories(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: categories } = useQuery({
    queryKey: ["event-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("event_categories").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: templateItems } = useQuery({
    queryKey: ["equipment-template-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipment_template_items")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingTemplate) {
        const { error } = await supabase
          .from("equipment_templates")
          .update({ name, description, category_id: categoryId || null, updated_at: new Date().toISOString() })
          .eq("id", editingTemplate.id);
        if (error) throw error;

        // Delete old items and re-insert
        await supabase.from("equipment_template_items").delete().eq("template_id", editingTemplate.id);
        if (items.length > 0) {
          const { error: itemsError } = await supabase.from("equipment_template_items").insert(
            items.map((item, i) => ({
              template_id: editingTemplate.id,
              name: item.name,
              is_mandatory: item.is_mandatory,
              notes: item.notes || null,
              sort_order: i,
            }))
          );
          if (itemsError) throw itemsError;
        }
      } else {
        const { data, error } = await supabase
          .from("equipment_templates")
          .insert({ name, description, category_id: categoryId || null })
          .select()
          .single();
        if (error) throw error;

        if (items.length > 0) {
          const { error: itemsError } = await supabase.from("equipment_template_items").insert(
            items.map((item, i) => ({
              template_id: data.id,
              name: item.name,
              is_mandatory: item.is_mandatory,
              notes: item.notes || null,
              sort_order: i,
            }))
          );
          if (itemsError) throw itemsError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment-templates"] });
      queryClient.invalidateQueries({ queryKey: ["equipment-template-items"] });
      toast({ title: editingTemplate ? "Template updated" : "Template created" });
      resetForm();
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("equipment_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment-templates"] });
      queryClient.invalidateQueries({ queryKey: ["equipment-template-items"] });
      toast({ title: "Template deleted" });
    },
  });

  function resetForm() {
    setDialogOpen(false);
    setEditingTemplate(null);
    setName("");
    setDescription("");
    setCategoryId("");
    setItems([]);
    setNewItemName("");
    setNewItemMandatory(false);
    setNewItemNotes("");
  }

  function openEdit(template: any) {
    setEditingTemplate(template);
    setName(template.name);
    setDescription(template.description);
    setCategoryId(template.category_id || "");
    const existingItems = (templateItems || [])
      .filter((i: any) => i.template_id === template.id)
      .map((i: any) => ({ id: i.id, name: i.name, is_mandatory: i.is_mandatory, notes: i.notes, sort_order: i.sort_order }));
    setItems(existingItems);
    setDialogOpen(true);
  }

  function addItem() {
    if (!newItemName.trim()) return;
    setItems([...items, { name: newItemName.trim(), is_mandatory: newItemMandatory, notes: newItemNotes || null, sort_order: items.length }]);
    setNewItemName("");
    setNewItemMandatory(false);
    setNewItemNotes("");
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  const getItemsForTemplate = (templateId: string) =>
    (templateItems || []).filter((i: any) => i.template_id === templateId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Equipment Templates</h1>
          <p className="text-muted-foreground mt-1">Manage predefined equipment lists for event categories</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); else setDialogOpen(true); }}>
          <DialogTrigger asChild>
            <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" /> Add Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingTemplate ? "Edit Template" : "Create Equipment Template"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Template Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Trekking Essentials" />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {categories?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe this template..." />
              </div>

              {/* Items */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Equipment Items</Label>
                {items.length > 0 && (
                  <div className="border rounded-lg divide-y">
                    {items.map((item, i) => (
                      <div key={i} className="flex items-center gap-3 p-3">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                        <span className="flex-1 text-sm">{item.name}</span>
                        {item.is_mandatory && <Badge variant="destructive" className="text-xs">Mandatory</Badge>}
                        {item.notes && <span className="text-xs text-muted-foreground max-w-[150px] truncate">{item.notes}</span>}
                        <Button variant="ghost" size="icon" onClick={() => removeItem(i)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <Card>
                  <CardContent className="pt-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Item Name</Label>
                        <Input value={newItemName} onChange={(e) => setNewItemName(e.target.value)} placeholder="e.g. Trekking boots" onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addItem())} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Notes</Label>
                        <Input value={newItemNotes} onChange={(e) => setNewItemNotes(e.target.value)} placeholder="e.g. min 2L water" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Switch checked={newItemMandatory} onCheckedChange={setNewItemMandatory} />
                        <Label className="text-xs">Mandatory</Label>
                      </div>
                      <Button variant="outline" size="sm" onClick={addItem} disabled={!newItemName.trim()}>
                        <Plus className="mr-1 h-3 w-3" /> Add Item
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Button className="w-full" onClick={() => saveMutation.mutate()} disabled={!name.trim() || saveMutation.isPending}>
                {saveMutation.isPending ? "Saving..." : editingTemplate ? "Update Template" : "Create Template"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : !templates?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Package className="h-12 w-12 mb-3" />
            <p className="text-lg font-medium">No equipment templates yet</p>
            <p className="text-sm">Create your first template to help organizers prepare equipment lists.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {templates.map((t: any) => {
            const tItems = getItemsForTemplate(t.id);
            return (
              <Card key={t.id}>
                <CardHeader className="flex flex-row items-start justify-between pb-3">
                  <div>
                    <CardTitle className="text-lg">{t.name}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      {t.event_categories?.name && (
                        <Badge variant="secondary">{t.event_categories.name}</Badge>
                      )}
                      <span className="text-xs text-muted-foreground">{tItems.length} items</span>
                    </div>
                    {t.description && <p className="text-sm text-muted-foreground mt-2">{t.description}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(t.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardHeader>
                {tItems.length > 0 && (
                  <CardContent className="pt-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead>Required</TableHead>
                          <TableHead>Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tItems.map((item: any) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell>
                              {item.is_mandatory ? (
                                <Badge variant="destructive" className="text-xs">Mandatory</Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs">Optional</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">{item.notes || "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
