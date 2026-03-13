import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, MoreHorizontal, Eye, Edit2, Trash2, Plus, Upload, X, ArrowUp, ArrowDown, Image as ImageIcon, Loader2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Event = Tables<"events">;

const statusColors: Record<string, string> = {
  available: "text-success border-success/30",
  full: "text-warning border-warning/30",
  closed: "text-destructive border-destructive/30",
};

const visibilityColors: Record<string, string> = {
  public: "text-success border-success/30",
  private: "text-primary border-primary/30",
  hidden: "text-muted-foreground border-muted-foreground/30",
};

const emptyEvent = {
  title: "", description: "", location: "", date: "", time: "09:00",
  spots_total: 20, price: 0, payment_type: "free" as const,
  status: "available" as const, visibility: "public" as const, 
  organizer_name: "", category_id: null as string | null,
  image_url: "" as string,
  gallery_images: [] as string[],
};

export default function EventsPage() {
  const [search, setSearch] = useState("");
  const [viewEvent, setViewEvent] = useState<Event | null>(null);
  const [editEvent, setEditEvent] = useState<(Partial<Event> & { isNew?: boolean }) | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const queryClient = useQueryClient();

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["admin-events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").order("date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["admin-categories-list"],
    queryFn: async () => {
      const { data } = await supabase.from("event_categories").select("id, name");
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (evt: any) => {
      const { isNew, ...data } = evt;
      if (isNew) {
        const { error } = await supabase.from("events").insert(data);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("events").update({ ...data, updated_at: new Date().toISOString() }).eq("id", data.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Event saved");
      queryClient.invalidateQueries({ queryKey: ["admin-events"] });
      setEditEvent(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Event deleted");
      queryClient.invalidateQueries({ queryKey: ["admin-events"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = events.filter((e) => e.title.toLowerCase().includes(search.toLowerCase()));

  const getCategoryName = (id: string | null) => categories.find((c) => c.id === id)?.name || "—";

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: "cover" | "gallery") => {
    const files = e.target.files;
    if (!files || files.length === 0 || !editEvent) return;

    const file = files[0];
    const fileExt = file.name.split(".").pop();
    const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `${fileName}`;

    setIsUploading(true);
    try {
      const { error: uploadError } = await supabase.storage
        .from("event-images")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("event-images")
        .getPublicUrl(filePath);

      if (type === "cover") {
        setEditEvent({ ...editEvent, image_url: publicUrl });
      } else {
        const currentGallery = (editEvent.gallery_images as any[]) || [];
        if (currentGallery.length >= 5) {
          toast.error("Maximum 5 gallery images allowed");
        } else {
          setEditEvent({ ...editEvent, gallery_images: [...currentGallery, publicUrl] });
        }
      }
      toast.success("Image uploaded");
    } catch (error: any) {
      toast.error("Error uploading image: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const removeGalleryImage = (index: number) => {
    if (!editEvent) return;
    const currentGallery = [...((editEvent.gallery_images as any[]) || [])];
    currentGallery.splice(index, 1);
    setEditEvent({ ...editEvent, gallery_images: currentGallery });
  };

  const moveGalleryImage = (index: number, direction: "up" | "down") => {
    if (!editEvent) return;
    const currentGallery = [...((editEvent.gallery_images as any[]) || [])];
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= currentGallery.length) return;
    [currentGallery[index], currentGallery[newIndex]] = [currentGallery[newIndex], currentGallery[index]];
    setEditEvent({ ...editEvent, gallery_images: currentGallery });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Events</h1>
          <p className="text-muted-foreground mt-1">Manage all events ({events.length} total)</p>
        </div>
        <Button className="gap-2" onClick={() => setEditEvent({ ...emptyEvent, isNew: true })}>
          <Plus className="h-4 w-4" /> Add Event
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search events..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Organizer</TableHead>
                  <TableHead>Category</TableHead>
                   <TableHead>Date</TableHead>
                  <TableHead>Spots</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Visibility</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="font-medium">{event.title}</TableCell>
                    <TableCell className="text-muted-foreground">{event.organizer_name}</TableCell>
                    <TableCell><Badge variant="secondary">{getCategoryName(event.category_id)}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{event.date}</TableCell>
                    <TableCell>{event.spots_taken}/{event.spots_total}</TableCell>
                     <TableCell>
                      <Badge variant="outline" className={statusColors[event.status] || ""}>{event.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={visibilityColors[event.visibility] || ""}>{event.visibility}</Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setViewEvent(event)}><Eye className="h-4 w-4 mr-2" /> View</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setEditEvent(event)}><Edit2 className="h-4 w-4 mr-2" /> Edit</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => { if (confirm("Delete this event?")) deleteMutation.mutate(event.id); }}>
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No events found</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* View Dialog */}
      <Dialog open={!!viewEvent} onOpenChange={(o) => !o && setViewEvent(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{viewEvent?.title}</DialogTitle></DialogHeader>
          {viewEvent && (
            <div className="space-y-3 text-sm">
              <p><strong>Location:</strong> {viewEvent.location}</p>
              <p><strong>Date:</strong> {viewEvent.date} at {viewEvent.time}</p>
              <p><strong>Organizer:</strong> {viewEvent.organizer_name}</p>
              <p><strong>Spots:</strong> {viewEvent.spots_taken}/{viewEvent.spots_total}</p>
               <p><strong>Price:</strong> {viewEvent.price > 0 ? `€${viewEvent.price}` : "Free"}</p>
              <p><strong>Status:</strong> {viewEvent.status}</p>
               <p><strong>Visibility:</strong> {viewEvent.visibility}</p>
              <p><strong>Description:</strong> {viewEvent.description || "—"}</p>
              
              <div className="space-y-4 pt-4">
                <p><strong>Cover Image:</strong></p>
                {viewEvent.image_url ? (
                  <img src={viewEvent.image_url} alt="Cover" className="w-full h-48 object-cover rounded-lg border" />
                ) : (
                  <div className="w-full h-48 bg-muted rounded-lg flex items-center justify-center border border-dashed">
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}

                {viewEvent.gallery_images && (viewEvent.gallery_images as string[]).length > 0 && (
                  <>
                    <p><strong>Gallery:</strong></p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {(viewEvent.gallery_images as string[]).map((img, idx) => (
                        <img key={idx} src={img} alt={`Gallery ${idx}`} className="w-full h-24 object-cover rounded-lg border" />
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit/Create Dialog */}
      <Dialog open={!!editEvent} onOpenChange={(o) => !o && setEditEvent(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editEvent?.isNew ? "Create Event" : "Edit Event"}</DialogTitle></DialogHeader>
          {editEvent && (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              <div><Label>Title</Label><Input value={editEvent.title || ""} onChange={(e) => setEditEvent({ ...editEvent, title: e.target.value })} /></div>
              <div><Label>Location</Label><Input value={editEvent.location || ""} onChange={(e) => setEditEvent({ ...editEvent, location: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Date</Label><Input type="date" value={editEvent.date || ""} onChange={(e) => setEditEvent({ ...editEvent, date: e.target.value })} /></div>
                <div><Label>Time</Label><Input type="time" value={editEvent.time || ""} onChange={(e) => setEditEvent({ ...editEvent, time: e.target.value })} /></div>
              </div>
              <div><Label>Organizer Name</Label><Input value={editEvent.organizer_name || ""} onChange={(e) => setEditEvent({ ...editEvent, organizer_name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Total Spots</Label><Input type="number" value={editEvent.spots_total || 20} onChange={(e) => setEditEvent({ ...editEvent, spots_total: parseInt(e.target.value) })} /></div>
                <div><Label>Price (€)</Label><Input type="number" value={editEvent.price || 0} onChange={(e) => setEditEvent({ ...editEvent, price: parseFloat(e.target.value) })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Status</Label>
                  <Select value={editEvent.status || "available"} onValueChange={(v) => setEditEvent({ ...editEvent, status: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">Available</SelectItem>
                      <SelectItem value="full">Full</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                 <div>
                  <Label>Category</Label>
                  <Select value={editEvent.category_id || "none"} onValueChange={(v) => setEditEvent({ ...editEvent, category_id: v === "none" ? null : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Visibility</Label>
                <Select value={editEvent.visibility || "public"} onValueChange={(v) => setEditEvent({ ...editEvent, visibility: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                    <SelectItem value="hidden">Hidden</SelectItem>
                  </SelectContent>
                </Select>
              </div>
               <div><Label>Description</Label><Textarea value={editEvent.description || ""} onChange={(e) => setEditEvent({ ...editEvent, description: e.target.value })} rows={3} /></div>

              <div className="space-y-4 pt-2 border-t mt-4">
                <h3 className="font-semibold text-sm">Media Settings</h3>
                
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    Cover Image <span className="text-destructive font-bold">*</span>
                  </Label>
                  <div className="flex items-start gap-4">
                    <div className="relative w-32 h-24 bg-muted rounded-md border border-dashed overflow-hidden flex items-center justify-center">
                      {editEvent.image_url ? (
                        <>
                          <img src={editEvent.image_url} alt="Preview" className="w-full h-full object-cover" />
                          <button 
                            type="button" 
                            onClick={() => setEditEvent({ ...editEvent, image_url: "" })}
                            className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </>
                      ) : (
                        <ImageIcon className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex flex-col gap-2 pt-1">
                      <Button variant="outline" size="sm" asChild disabled={isUploading}>
                        <label className="cursor-pointer">
                          {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                          Upload Cover
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, "cover")} />
                        </label>
                      </Button>
                      <p className="text-[10px] text-muted-foreground">Mandatory cover image for cards and featured sections.</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center justify-between">
                    <span>Gallery Images ({ ((editEvent.gallery_images as any[]) || []).length }/5)</span>
                    { ((editEvent.gallery_images as any[]) || []).length < 5 && (
                      <Button variant="ghost" size="sm" asChild disabled={isUploading} className="h-7 text-xs">
                        <label className="cursor-pointer">
                          <Plus className="h-3 w-3 mr-1" /> Add Image
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, "gallery")} />
                        </label>
                      </Button>
                    )}
                  </Label>
                  <div className="space-y-2">
                    { ((editEvent.gallery_images as any[]) || []).length === 0 && (
                      <p className="text-xs text-muted-foreground italic">No gallery images added yet.</p>
                    )}
                    { ((editEvent.gallery_images as any[]) || []).map((img, idx) => (
                      <div key={idx} className="flex items-center gap-3 bg-muted/30 p-2 rounded-md border">
                        <img src={img} alt={`Gallery ${idx}`} className="w-12 h-10 object-cover rounded border" />
                        <div className="flex-1 text-[10px] truncate max-w-[200px] font-mono text-muted-foreground">
                          {img.split("/").pop()}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={idx === 0} onClick={() => moveGalleryImage(idx, "up")}>
                            <ArrowUp className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={idx === ((editEvent.gallery_images as any[]) || []).length - 1} onClick={() => moveGalleryImage(idx, "down")}>
                            <ArrowDown className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeGalleryImage(idx)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
           <DialogFooter>
            <Button variant="outline" onClick={() => setEditEvent(null)}>Cancel</Button>
            <Button 
              onClick={() => saveMutation.mutate(editEvent)} 
              disabled={saveMutation.isPending || !editEvent?.image_url}
            >
              {saveMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
