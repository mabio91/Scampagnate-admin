import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Plus, Edit2, Trash2, MessageCircle, Upload, X, ChevronLeft, ChevronRight, GripVertical, Star } from "lucide-react";
import RefreshButton from "@/components/RefreshButton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { useLanguage } from "@/i18n/LanguageContext";
import { cn } from "@/lib/utils";

type MerchProduct = Tables<"merch_products">;

const MAX_GALLERY_IMAGES = 5;

const emptyProduct = {
  name: "",
  name_it: "",
  description: "",
  description_it: "",
  price: 0,
  image_url: "",
  gallery_images: [] as string[],
  badge: "",
  badge_it: "",
  is_active: true,
  sort_order: 0,
  whatsapp_number: "",
};

// --- Product Card with Image Carousel ---
function ProductImageCarousel({ images, alt }: { images: string[]; alt: string }) {
  const [current, setCurrent] = useState(0);

  if (images.length === 0) return null;
  if (images.length === 1) {
    return <img src={images[0]} alt={alt} className="w-full h-full object-contain" />;
  }

  return (
    <div className="relative w-full h-full group/carousel">
      <img src={images[current]} alt={`${alt} ${current + 1}`} className="w-full h-full object-contain transition-opacity duration-200" />
      <button
        onClick={(e) => { e.stopPropagation(); setCurrent((p) => (p - 1 + images.length) % images.length); }}
        className="absolute left-1 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm rounded-full p-1 opacity-0 group-hover/carousel:opacity-100 transition-opacity"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); setCurrent((p) => (p + 1) % images.length); }}
        className="absolute right-1 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm rounded-full p-1 opacity-0 group-hover/carousel:opacity-100 transition-opacity"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
        {images.map((_, i) => (
          <button
            key={i}
            onClick={(e) => { e.stopPropagation(); setCurrent(i); }}
            className={cn(
              "h-1.5 rounded-full transition-all",
              i === current ? "w-4 bg-primary" : "w-1.5 bg-muted-foreground/40"
            )}
          />
        ))}
      </div>
    </div>
  );
}

// --- Gallery Editor in Dialog ---
function GalleryEditor({
  heroUrl,
  galleryImages,
  onHeroChange,
  onGalleryChange,
  uploading,
  uploadProgress,
  onUpload,
}: {
  heroUrl: string;
  galleryImages: string[];
  onHeroChange: (url: string) => void;
  onGalleryChange: (urls: string[]) => void;
  uploading: boolean;
  uploadProgress: { current: number; total: number } | null;
  onUpload: (target: "hero" | "gallery") => void;
}) {
  const { t } = useLanguage();
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const removeGalleryImage = (index: number) => {
    onGalleryChange(galleryImages.filter((_, i) => i !== index));
  };

  const promoteToHero = (index: number) => {
    const newHero = galleryImages[index];
    const newGallery = [...galleryImages];
    newGallery[index] = heroUrl;
    onHeroChange(newHero);
    onGalleryChange(newGallery.filter(Boolean));
  };

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (index: number) => {
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    const reordered = [...galleryImages];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(index, 0, moved);
    onGalleryChange(reordered);
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div className="space-y-3">
      {/* Hero Image */}
      <div>
        <Label className="flex items-center gap-1.5">
          <Star className="h-3.5 w-3.5 text-primary" />
          {t("merch.heroImage")} <span className="text-destructive">*</span>
        </Label>
        <div className="mt-1.5">
          {heroUrl ? (
            <div className="relative rounded-lg border border-border overflow-hidden bg-muted/30">
              <img src={heroUrl} alt="Hero" className="w-full h-48 object-contain p-2" />
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 h-7 w-7"
                onClick={() => onHeroChange("")}
                type="button"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onUpload("hero")}
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
                  <span className="text-sm">{t("merch.uploadHeroHint")}</span>
                </>
              )}
            </button>
          )}
          {heroUrl && (
            <Button variant="outline" size="sm" className="mt-2 gap-2" onClick={() => onUpload("hero")} disabled={uploading} type="button">
              <Upload className="h-3.5 w-3.5" />
              {uploading ? t("merch.uploading") : t("merch.changeImage")}
            </Button>
          )}
        </div>
      </div>

      {/* Gallery Images */}
      <div>
        <div className="flex items-center justify-between">
          <Label>{t("merch.galleryImages")} ({galleryImages.length}/{MAX_GALLERY_IMAGES})</Label>
          {galleryImages.length > 1 && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <GripVertical className="h-3 w-3" /> {t("merch.dragToReorder")}
            </span>
          )}
        </div>
        <div className="mt-1.5 grid grid-cols-3 gap-2">
          {galleryImages.map((url, i) => (
            <div
              key={`${url}-${i}`}
              draggable
              onDragStart={() => handleDragStart(i)}
              onDragOver={(e) => handleDragOver(e, i)}
              onDrop={() => handleDrop(i)}
              onDragEnd={handleDragEnd}
              className={cn(
                "relative rounded-lg border overflow-hidden bg-muted/30 aspect-square group/thumb cursor-grab active:cursor-grabbing transition-all",
                dragOverIndex === i && dragIndex !== i ? "border-primary ring-2 ring-primary/30" : "border-border",
                dragIndex === i ? "opacity-50" : ""
              )}
            >
              <img src={url} alt={`Gallery ${i + 1}`} className="w-full h-full object-contain p-1" />
              <div className="absolute top-1 left-1 bg-background/70 rounded px-1 text-[10px] font-medium text-muted-foreground">
                {i + 1}
              </div>
              <div className="absolute inset-0 bg-background/60 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center gap-1">
                <Button variant="secondary" size="icon" className="h-7 w-7" onClick={() => promoteToHero(i)} type="button" title={t("merch.setAsHero")}>
                  <Star className="h-3.5 w-3.5" />
                </Button>
                <Button variant="destructive" size="icon" className="h-7 w-7" onClick={() => removeGalleryImage(i)} type="button">
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
          {galleryImages.length < MAX_GALLERY_IMAGES && (
            <button
              type="button"
              onClick={() => onUpload("gallery")}
              className="aspect-square border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary/50 hover:bg-muted/20 transition-colors cursor-pointer"
              disabled={uploading}
            >
              {uploading ? (
                <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Plus className="h-5 w-5" />
                  <span className="text-xs">{t("merch.addImage")}</span>
                </>
              )}
            </button>
          )}
        </div>
        {/* Upload Progress Bar */}
        {uploading && uploadProgress && uploadProgress.total > 0 && (
          <div className="mt-2 space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{t("merch.uploading")} {uploadProgress.current}/{uploadProgress.total}</span>
              <span>{Math.round((uploadProgress.current / uploadProgress.total) * 100)}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
                style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MerchPage() {
  const { t, language } = useLanguage();
  const [editProduct, setEditProduct] = useState<(Partial<MerchProduct> & { isNew?: boolean }) | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [uploadTarget, setUploadTarget] = useState<"hero" | "gallery">("hero");
  const heroFileInputRef = useRef<HTMLInputElement>(null);
  const galleryFileInputRef = useRef<HTMLInputElement>(null);
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

  const validateFile = (file: File): string | null => {
    const validTypes = ["image/png", "image/jpeg", "image/jpg"];
    if (!validTypes.includes(file.type)) return `${file.name}: Only PNG and JPG files are supported`;
    if (file.size > 5 * 1024 * 1024) return `${file.name}: File size must be less than 5MB`;
    return null;
  };

  const handleHeroFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateFile(file);
    if (err) { toast.error(err); return; }

    setUploading(true);
    setUploadProgress({ current: 0, total: 1 });
    try {
      const url = await uploadImage(file);
      setUploadProgress({ current: 1, total: 1 });
      setEditProduct((prev) => prev ? { ...prev, image_url: url } : null);
      toast.success(t("merch.imageUploaded"));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      setUploadProgress(null);
      if (heroFileInputRef.current) heroFileInputRef.current.value = "";
    }
  };

  const handleGalleryFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const currentGallery = getGalleryArray(editProduct?.gallery_images);
    const slotsAvailable = MAX_GALLERY_IMAGES - currentGallery.length;

    if (slotsAvailable <= 0) {
      toast.error(`Maximum ${MAX_GALLERY_IMAGES} gallery images allowed`);
      return;
    }

    const filesToUpload = files.slice(0, slotsAvailable);
    if (files.length > slotsAvailable) {
      toast.warning(`Only ${slotsAvailable} more image(s) allowed. ${files.length - slotsAvailable} skipped.`);
    }

    // Validate all files first
    for (const file of filesToUpload) {
      const err = validateFile(file);
      if (err) { toast.error(err); return; }
    }

    setUploading(true);
    setUploadProgress({ current: 0, total: filesToUpload.length });
    const uploadedUrls: string[] = [];

    for (let i = 0; i < filesToUpload.length; i++) {
      try {
        const url = await uploadImage(filesToUpload[i]);
        uploadedUrls.push(url);
        setUploadProgress({ current: i + 1, total: filesToUpload.length });
      } catch (err: any) {
        toast.error(`${filesToUpload[i].name}: ${err.message}`);
      }
    }

    if (uploadedUrls.length > 0) {
      setEditProduct((prev) => {
        if (!prev) return null;
        const current = getGalleryArray(prev.gallery_images);
        return { ...prev, gallery_images: [...current, ...uploadedUrls] } as any;
      });
      toast.success(`${uploadedUrls.length} ${uploadedUrls.length === 1 ? 'image' : 'images'} uploaded`);
    }

    setUploading(false);
    setUploadProgress(null);
    if (galleryFileInputRef.current) galleryFileInputRef.current.value = "";
  };

  const triggerUpload = (target: "hero" | "gallery") => {
    if (target === "hero") {
      heroFileInputRef.current?.click();
    } else {
      galleryFileInputRef.current?.click();
    }
  };

  const getGalleryArray = (val: any): string[] => {
    if (Array.isArray(val)) return val.filter((v) => typeof v === "string" && v);
    return [];
  };

  const getAllImages = (product: MerchProduct): string[] => {
    const images: string[] = [];
    if (product.image_url) images.push(product.image_url);
    const gallery = getGalleryArray((product as any).gallery_images);
    images.push(...gallery);
    return images;
  };

  const saveMutation = useMutation({
    mutationFn: async (product: any) => {
      const { isNew, id, created_at, updated_at, ...data } = product;
      // Ensure gallery_images is a proper array
      data.gallery_images = getGalleryArray(data.gallery_images);
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
    const number = product.whatsapp_number || "";
    const msg = encodeURIComponent(`Ciao! Sono interessato al prodotto "${getName(product)}" (€${product.price.toFixed(2)}). Vorrei avere maggiori informazioni.`);
    window.open(`https://wa.me/${number}?text=${msg}`, "_blank");
  };

  const openEditDialog = (product?: MerchProduct) => {
    if (product) {
      setEditProduct({ ...product, gallery_images: getGalleryArray((product as any).gallery_images) } as any);
    } else {
      setEditProduct({ ...emptyProduct, isNew: true });
    }
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
          {products.map((product) => {
            const allImages = getAllImages(product);
            return (
              <Card key={product.id} className="overflow-hidden hover:shadow-lg transition-shadow group">
                <div className="relative bg-muted/30 aspect-square flex items-center justify-center p-4">
                  {allImages.length > 0 ? (
                    <ProductImageCarousel images={allImages} alt={getName(product)} />
                  ) : (
                    <div className="text-muted-foreground text-sm">{t("merch.noImage")}</div>
                  )}
                  {getBadge(product) && (
                    <Badge className="absolute top-3 left-3 bg-primary hover:bg-primary/90 text-primary-foreground border-0 z-10">
                      {getBadge(product)}
                    </Badge>
                  )}
                  {!product.is_active && (
                    <Badge variant="secondary" className="absolute top-3 right-3 z-10">
                      {t("common.inactive")}
                    </Badge>
                  )}
                  <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
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
                  <Button variant="default" className="w-full mt-2 gap-2" onClick={() => openWhatsApp(product)}>
                    <MessageCircle className="h-4 w-4" /> WhatsApp
                  </Button>
                </CardContent>
              </Card>
            );
          })}
          {products.length === 0 && (
            <p className="text-muted-foreground col-span-full text-center py-8">{t("merch.noProducts")}</p>
          )}
        </div>
      )}

      {/* Edit/Create Dialog */}
      <Dialog open={!!editProduct} onOpenChange={(o) => { if (!o) setEditProduct(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editProduct?.isNew ? t("merch.createProduct") : t("merch.editProduct")}</DialogTitle>
          </DialogHeader>
          {editProduct && (
            <div className="space-y-4">
              <div>
                <Label>Nome</Label>
                <Input value={editProduct.name_it || editProduct.name || ""} onChange={(e) => setEditProduct({ ...editProduct, name: e.target.value, name_it: e.target.value })} />
              </div>
              <div>
                <Label>Descrizione</Label>
                <Textarea value={editProduct.description_it || editProduct.description || ""} onChange={(e) => setEditProduct({ ...editProduct, description: e.target.value, description_it: e.target.value })} rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t("events.price")} (€)</Label>
                  <Input type="number" step="0.01" value={editProduct.price ?? 0} onChange={(e) => setEditProduct({ ...editProduct, price: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label>{t("merch.sortOrder")}</Label>
                  <Input type="number" value={editProduct.sort_order ?? ""} onChange={(e) => setEditProduct({ ...editProduct, sort_order: e.target.value === "" ? 0 : parseInt(e.target.value) })} />
                </div>
              </div>

              {/* Multi-Image Editor */}
              <GalleryEditor
                heroUrl={editProduct.image_url || ""}
                galleryImages={getGalleryArray(editProduct.gallery_images)}
                onHeroChange={(url) => setEditProduct({ ...editProduct, image_url: url })}
                onGalleryChange={(urls) => setEditProduct({ ...editProduct, gallery_images: urls } as any)}
                uploading={uploading}
                uploadProgress={uploadProgress}
                onUpload={triggerUpload}
              />
              <input
                ref={heroFileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                className="hidden"
                onChange={handleHeroFileSelect}
              />
              <input
                ref={galleryFileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                multiple
                className="hidden"
                onChange={handleGalleryFileSelect}
              />

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
            <Button variant="outline" onClick={() => setEditProduct(null)}>{t("common.cancel")}</Button>
            <Button onClick={() => saveMutation.mutate(editProduct)} disabled={saveMutation.isPending || uploading}>
              {saveMutation.isPending ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
