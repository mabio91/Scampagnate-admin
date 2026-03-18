import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Plus, Edit2, Trash2, MessageCircle, Upload, ImageIcon, X } from "lucide-react";
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
  whatsapp_number: "",
};

export default function MerchPage() {
  const { t, language } = useLanguage();
  const [editProduct, setEditProduct] = useState<(Partial<MerchProduct> & { isNew?: boolean }) | null>(null);
  const [uploading, setUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["admin-merch"],
    queryFn: async () => {
      const { data, error } = await supabase.from("merch_products").select("*").order("sort_order");
      if (error) throw error;
      return data || [];
    },
  });

  const uploadImage = async (file: File): Promise<string> => {
    const fileExt = file.name.split(".").pop()?.toLowerCase();
    if (!fileExt || !["png", "jpg", "jpeg"].includes(fileExt)) {
      throw new Error("Only PNG and JPG files are supported");
    }
    const fileName = `merch/${crypto.randomUUID()}.${fileExt}`;
    const { error } = await supabase.storage.from("event-images").upload(fileName, file, {
      contentType: file.type,
      upsert: false,
    });
    if (error) throw error;
    const { data: pub } = supabase.storage.from("event-images").getPublicUrl(fileName);
    return pub.publicUrl;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ["image/png", "image/jpeg", "image/jpg"];
    if (!validTypes.includes(file.type)) {
      toast.error("Only PNG and JPG files are supported");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    // Show preview immediately
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    setUploading(true);
    try {
      const url = await uploadImage(file);
      setEditProduct((prev) => prev ? { ...prev, image_url: url } : null);
      toast.success(t("merch.imageUploaded"));
    } catch (err: any) {
      toast.error(err.message);
      setImagePreview(null);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeImage = () => {
    setEditProduct((prev) => prev ? { ...prev, image_url: "" } : null);
    setImagePreview(null);
  };

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
      setImagePreview(null);
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
    const number = (product as any).whatsapp_number || "";
    const msg = encodeURIComponent(`Ciao! Sono interessato al prodotto "${getName(product)}" (€${product.price.toFixed(2)}). Vorrei avere maggiori informazioni.`);
    window.open(`https://wa.me/${number}?text=${msg}`, "_blank");
  };

  const openEditDialog = (product?: MerchProduct) => {
    setImagePreview(null);
    if (product) {
      setEditProduct(product);
    } else {
      setEditProduct({ ...emptyProduct, isNew: true });
    }
  };

  const currentImageUrl = imagePreview || editProduct?.image_url;

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
          <Button className="gap-2 flex-1 sm:flex-initial" onClick={() => openEditDialog()}>
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
                  <Badge className="absolute top-3 left-3 bg-primary hover:bg-primary/90 text-primary-foreground border-0">
                    {getBadge(product)}
                  </Badge>
                )}
                {!product.is_active && (
                  <Badge variant="secondary" className="absolute top-3 right-3">
                    {t("common.inactive")}
                  </Badge>
                )}
                <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="secondary" size="icon" className="h-8 w-8" onClick={() => openEditDialog(product)}>
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
                  variant="default"
                  className="w-full mt-2 gap-2"
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
      <Dialog open={!!editProduct} onOpenChange={(o) => { if (!o) { setEditProduct(null); setImagePreview(null); } }}>
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

              {/* Image Upload */}
              <div>
                <Label>{t("merch.productImage")}</Label>
                <div className="mt-2">
                  {currentImageUrl ? (
                    <div className="relative rounded-lg border border-border overflow-hidden bg-muted/30">
                      <img
                        src={currentImageUrl}
                        alt="Preview"
                        className="w-full h-48 object-contain p-2"
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-7 w-7"
                        onClick={removeImage}
                        type="button"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full h-36 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary/50 hover:bg-muted/20 transition-colors cursor-pointer"
                      disabled={uploading}
                    >
                      {uploading ? (
                        <>
                          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          <span className="text-sm">{t("merch.uploading")}</span>
                        </>
                      ) : (
                        <>
                          <Upload className="h-8 w-8" />
                          <span className="text-sm">{t("merch.uploadHint")}</span>
                        </>
                      )}
                    </button>
                  )}
                  {currentImageUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 gap-2"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      type="button"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      {uploading ? t("merch.uploading") : t("merch.changeImage")}
                    </Button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                </div>
              </div>

              {/* WhatsApp Number */}
              <div>
                <Label>{t("merch.whatsappNumber")}</Label>
                <Input
                  value={(editProduct as any).whatsapp_number || ""}
                  onChange={(e) => setEditProduct({ ...editProduct, whatsapp_number: e.target.value } as any)}
                  placeholder="e.g. 393331234567"
                />
                <p className="text-xs text-muted-foreground mt-1">{t("merch.whatsappHint")}</p>
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
            <Button variant="outline" onClick={() => { setEditProduct(null); setImagePreview(null); }}>{t("common.cancel")}</Button>
            <Button onClick={() => saveMutation.mutate(editProduct)} disabled={saveMutation.isPending || uploading}>
              {saveMutation.isPending ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
