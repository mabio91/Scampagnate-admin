import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { useLanguage } from "@/i18n/LanguageContext";

type Category = Tables<"event_categories">;

const emptyCategory = { name: "", description: "", icon: "📂", sort_order: 0 };

export default function CategoriesPage() {
  const { t } = useLanguage();
  const [editCat, setEditCat] = useState<(Partial<Category> & { isNew?: boolean }) | null>(null);
  const queryClient = useQueryClient();

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("event_categories").select("*").order("sort_order");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: eventCounts = {} } = useQuery({
    queryKey: ["admin-category-event-counts"],
    queryFn: async () => {
      const { data } = await supabase.from("events").select("category_id");
      const counts: Record<string, number> = {};
      data?.forEach((e) => { if (e.category_id) counts[e.category_id] = (counts[e.category_id] || 0) + 1; });
      return counts;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (cat: any) => {
      const { isNew, id, ...data } = cat;
      if (isNew) {
        const { error } = await supabase.from("event_categories").insert(data);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("event_categories").update(data).eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Category saved");
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      setEditCat(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("event_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Category deleted");
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Event Categories</h1>
          <p className="text-muted-foreground mt-1">Manage event categories ({categories.length} total)</p>
        </div>
        <Button className="gap-2 w-full sm:w-auto" onClick={() => setEditCat({ ...emptyCategory, isNew: true })}>
          <Plus className="h-4 w-4" /> Add Category
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat) => (
            <Card key={cat.id} className="hover:shadow-md transition-shadow group">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-primary/10 text-xl">{cat.icon || "📂"}</div>
                    <div>
                      <h3 className="font-semibold font-sans">{cat.name}</h3>
                      <p className="text-sm text-muted-foreground">{eventCounts[cat.id] || 0} events</p>
                      {cat.description && <p className="text-xs text-muted-foreground mt-0.5">{cat.description}</p>}
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditCat(cat)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { if (confirm("Delete this category?")) deleteMutation.mutate(cat.id); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {categories.length === 0 && (
            <p className="text-muted-foreground col-span-full text-center py-8">No categories yet</p>
          )}
        </div>
      )}

      <Dialog open={!!editCat} onOpenChange={(o) => !o && setEditCat(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editCat?.isNew ? "Create Category" : "Edit Category"}</DialogTitle></DialogHeader>
          {editCat && (
            <div className="space-y-4">
              <div><Label>Name</Label><Input value={editCat.name || ""} onChange={(e) => setEditCat({ ...editCat, name: e.target.value })} /></div>
              <div><Label>Icon (emoji)</Label><Input value={editCat.icon || ""} onChange={(e) => setEditCat({ ...editCat, icon: e.target.value })} /></div>
              <div><Label>Description</Label><Input value={editCat.description || ""} onChange={(e) => setEditCat({ ...editCat, description: e.target.value })} /></div>
              <div><Label>Sort Order</Label><Input type="number" value={editCat.sort_order ?? ""} onChange={(e) => setEditCat({ ...editCat, sort_order: e.target.value === "" ? undefined : parseInt(e.target.value, 10) })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCat(null)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate(editCat)} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
