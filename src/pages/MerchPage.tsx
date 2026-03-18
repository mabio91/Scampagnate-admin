import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Plus, Edit2, Trash2, MessageCircle, ExternalLink } from "lucide-react";
import RefreshButton from "@/components/RefreshButton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { useLanguage } from "@/i18n/LanguageContext";

type MerchProduct = Tables<"merch_products">;

const emptyProduct = {
  name: "",
  name_it: "",
  description: "",
  description_it: "",
  price: 0,
  image_url: "",
  badge: "",
  badge_it: "",
  is_active: true,
  sort_order: 0,
};

export default function MerchPage() {
  const { t, language } = useLanguage();
  const [editProduct, setEditProduct] = useState<(Partial<MerchProduct> & { isNew?: boolean }) | null>(null);
  const queryClient = useQueryClient();

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["admin-merch"],
    queryFn: async () => {
      const { data, error } = await supabase.from("merch_products").select("*").order("sort_order");
      if (error) throw error;
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (product: any) => {
      const { isNew, id, created_at, updated_at, ...data } = product;
      if (isNew) {
        const { error } = await supabase.from("merch_products").insert(data);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("merch_products").update(data).eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(t("merch.saved"));
      queryClient.invalidateQueries({ queryKey: ["admin-merch"] });
      setEditProduct(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("merch_products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("merch.deleted"));
      queryClient.invalidateQueries({ queryKey: ["admin-merch"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const getName = (p: MerchProduct) => (language === "it" && p.name_it ? p.name_it : p.name);
  const getDesc = (p: MerchProduct) => (language === "it" && p.description_it ? p.description_it : p.description);
  const getBadge = (p: MerchProduct) => (language === "it" && p.badge_it ? p.badge_it : p.badge);

  const openWhatsApp = (product: MerchProduct) => {
    const msg = encodeURIComponent(`Ciao! Sono interessato al prodotto "${getName(product)}" (€${product.price.toFixed(2)}). Vorrei avere maggiori informazioni.`);
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">{t("merch.title")}</h1>
          <p className="text-muted-foreground mt-1">
            {t("merch.subtitle")} ({products.length} {t("common.total").toLowerCase()})
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <RefreshButton queryKeys={[["admin-merch"]]} />
          <Button className="gap-2 flex-1 sm:flex-initial" onClick={() => setEditProduct({ ...emptyProduct, isNew: true })}>
            <Plus className="h-4 w-4" /> {t("merch.addProduct")}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-80 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product) => (
            <Card key={product.id} className="overflow-hidden hover:shadow-lg transition-shadow group">
              <div className="relative bg-muted/30 aspect-square flex items-center justify-center p-4">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={getName(product)}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-muted-foreground text-sm">{t("merch.noImage")}</div>
                )}
                {getBadge(product) && (
                  <Badge className="absolute top-3 left-3 bg-orange-500 hover:bg-orange-600 text-white border-0">
                    {getBadge(product)}
                  </Badge>
                )}
                {!product.is_active && (
                  <Badge variant="secondary" className="absolute top-3 right-3">
                    {t("common.inactive")}
                  </Badge>
                )}
                <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="secondary" size="icon" className="h-8 w-8" onClick={() => setEditProduct(product)}>
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="secondary" size="icon" className="h-8 w-8 text-destructive" onClick={() => { if (confirm(t("merch.deleteConfirm"))) deleteMutation.mutate(product.id); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <CardContent className="p-4 space-y-2">
                <h3 className="font-semibold text-lg">{getName(product)}</h3>
                <p className="text-xl font-bold text-primary">€{product.price.toFixed(2)}</p>
                {getDesc(product) && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{getDesc(product)}</p>
                )}
                <Button
                  className="w-full mt-2 gap-2 bg-green-500 hover:bg-green-600 text-white"
                  onClick={() => openWhatsApp(product)}
                >
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </Button>
              </CardContent>
            </Card>
          ))}
          {products.length === 0 && (
            <p className="text-muted-foreground col-span-full text-center py-8">{t("merch.noProducts")}</p>
          )}
        </div>
      )}

      {/* Edit/Create Dialog */}
      <Dialog open={!!editProduct} onOpenChange={(o) => !o && setEditProduct(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editProduct?.isNew ? t("merch.createProduct") : t("merch.editProduct")}</DialogTitle>
          </DialogHeader>
          {editProduct && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t("merch.nameEn")}</Label>
                  <Input value={editProduct.name || ""} onChange={(e) => setEditProduct({ ...editProduct, name: e.target.value })} />
                </div>
                <div>
                  <Label>{t("merch.nameIt")}</Label>
                  <Input value={editProduct.name_it || ""} onChange={(e) => setEditProduct({ ...editProduct, name_it: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t("merch.descEn")}</Label>
                  <Textarea value={editProduct.description || ""} onChange={(e) => setEditProduct({ ...editProduct, description: e.target.value })} rows={3} />
                </div>
                <div>
                  <Label>{t("merch.descIt")}</Label>
                  <Textarea value={editProduct.description_it || ""} onChange={(e) => setEditProduct({ ...editProduct, description_it: e.target.value })} rows={3} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t("events.price")} (€)</Label>
                  <Input type="number" step="0.01" value={editProduct.price ?? 0} onChange={(e) => setEditProduct({ ...editProduct, price: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label>{t("merch.sortOrder")}</Label>
                  <Input type="number" value={editProduct.sort_order ?? 0} onChange={(e) => setEditProduct({ ...editProduct, sort_order: parseInt(e.target.value) || 0 })} />
                </div>
              </div>
              <div>
                <Label>{t("merch.imageUrl")}</Label>
                <Input value={editProduct.image_url || ""} onChange={(e) => setEditProduct({ ...editProduct, image_url: e.target.value })} placeholder="https://..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t("merch.badgeEn")}</Label>
                  <Input value={editProduct.badge || ""} onChange={(e) => setEditProduct({ ...editProduct, badge: e.target.value })} placeholder="e.g. Bestseller" />
                </div>
                <div>
                  <Label>{t("merch.badgeIt")}</Label>
                  <Input value={editProduct.badge_it || ""} onChange={(e) => setEditProduct({ ...editProduct, badge_it: e.target.value })} placeholder="es. Più venduto" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={editProduct.is_active ?? true}
                  onCheckedChange={(checked) => setEditProduct({ ...editProduct, is_active: checked })}
                />
                <Label>{t("common.active")}</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditProduct(null)}>{t("common.cancel")}</Button>
            <Button onClick={() => saveMutation.mutate(editProduct)} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
