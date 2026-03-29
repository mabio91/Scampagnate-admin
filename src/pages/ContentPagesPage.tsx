import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Eye, EyeOff, FileText } from "lucide-react";
import { toast } from "sonner";
import { RichTextEditor } from "@/components/RichTextEditor";

interface ContentPage {
  id: string;
  title: string;
  slug: string;
  content_html: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export default function ContentPagesPage() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [editingPage, setEditingPage] = useState<ContentPage | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    content_html: "",
    is_published: false,
  });

  const { data: pages = [], isLoading } = useQuery({
    queryKey: ["content-pages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_pages")
        .select("*")
        .order("title");
      if (error) throw error;
      return data as ContentPage[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData & { id?: string }) => {
      if (data.id) {
        const { error } = await supabase
          .from("content_pages")
          .update({
            title: data.title,
            slug: data.slug,
            content_html: data.content_html,
            is_published: data.is_published,
            updated_at: new Date().toISOString(),
          })
          .eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("content_pages").insert({
          title: data.title,
          slug: data.slug,
          content_html: data.content_html,
          is_published: data.is_published,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content-pages"] });
      toast.success(editingPage ? "Pagina aggiornata" : "Pagina creata");
      closeModal();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("content_pages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content-pages"] });
      toast.success("Pagina eliminata");
    },
  });

  const openCreate = () => {
    setFormData({ title: "", slug: "", content_html: "", is_published: false });
    setEditingPage(null);
    setIsCreating(true);
  };

  const openEdit = (page: ContentPage) => {
    setFormData({
      title: page.title,
      slug: page.slug,
      content_html: page.content_html,
      is_published: page.is_published,
    });
    setEditingPage(page);
    setIsCreating(true);
  };

  const closeModal = () => {
    setIsCreating(false);
    setEditingPage(null);
  };

  const handleSave = () => {
    if (!formData.title || !formData.slug) {
      toast.error("Titolo e slug sono obbligatori");
      return;
    }
    saveMutation.mutate({ ...formData, id: editingPage?.id });
  };

  const generateSlug = (title: string) =>
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();

  const isModalOpen = isCreating;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pagine Contenuto</h1>
          <p className="text-muted-foreground">Gestisci le pagine informative dell'app</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Nuova Pagina
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titolo</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    </TableRow>
                  ))}
                </>
              ) : pages.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    <FileText className="mx-auto h-8 w-8 mb-2 opacity-50" />
                    Nessuna pagina creata
                  </TableCell>
                </TableRow>
              ) : (
                pages.map((page) => (
                  <TableRow key={page.id}>
                    <TableCell className="font-medium">{page.title}</TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">/{page.slug}</TableCell>
                    <TableCell>
                      {page.is_published ? (
                        <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                          <Eye className="mr-1 h-3 w-3" /> Pubblicata
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <EyeOff className="mr-1 h-3 w-3" /> Bozza
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(page)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteMutation.mutate(page.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPage ? "Modifica Pagina" : "Nuova Pagina"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Titolo</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => {
                    const title = e.target.value;
                    setFormData((prev) => ({
                      ...prev,
                      title,
                      slug: editingPage ? prev.slug : generateSlug(title),
                    }));
                  }}
                  placeholder="es. Chi siamo"
                />
              </div>
              <div className="space-y-2">
                <Label>Slug</Label>
                <Input
                  value={formData.slug}
                  onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value }))}
                  placeholder="es. chi-siamo"
                  className="font-mono text-sm"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={formData.is_published}
                onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, is_published: checked }))}
              />
              <Label>Pubblicata</Label>
            </div>

            <div className="space-y-2">
              <Label>Contenuto</Label>
              <RichTextEditor
                content={formData.content_html}
                onChange={(html) => setFormData((prev) => ({ ...prev, content_html: html }))}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeModal}>Annulla</Button>
              <Button onClick={handleSave} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Salvataggio..." : "Salva"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
