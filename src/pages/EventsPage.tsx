import { useState, useRef } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, MoreHorizontal, Edit2, Trash2, Plus, MapPin, Calendar, Clock, Users, DollarSign, Mountain, Timer, ChevronRight, Upload, X, ImageIcon } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Event = Tables<"events">;
type EventWithCategory = Event & { event_categories: { name: string; icon: string } | null };

const statusColors: Record<string, string> = {
  available: "text-success border-success/30 bg-success/10",
  full: "text-warning border-warning/30 bg-warning/10",
  closed: "text-destructive border-destructive/30 bg-destructive/10",
};

const paymentLabels: Record<string, string> = {
  free: "Free",
  paid: "Paid",
  deposit: "Deposit",
  location: "Pay at location",
};

const SUPABASE_URL = "https://etiynvukviykquqcsjln.supabase.co";

function isValidUrl(str: string | null): boolean {
  if (!str) return false;
  return str.startsWith("http://") || str.startsWith("https://") || str.startsWith("/");
}

function getImageUrl(imageUrl: string | null): string | null {
  if (!imageUrl) return null;
  if (isValidUrl(imageUrl)) return imageUrl;
  // It's a storage path - build the public URL
  if (!imageUrl.includes("/")) return null; // just a label like "trekking", not a real path
  return `${SUPABASE_URL}/storage/v1/object/public/event-images/${imageUrl}`;
}

const emptyEvent: Partial<Event> & { isNew?: boolean } = {
  title: "", description: "", location: "", date: "", time: "09:00",
  spots_total: 20, price: 0, payment_type: "free" as const,
  status: "available" as const, organizer_name: "", category_id: null,
  difficulty: null, distance: null, elevation: null, duration: null,
  deposit: null, featured: false, cancellation_policy: null, image_url: null,
  isNew: true,
};

export default function EventsPage() {
  const [search, setSearch] = useState("");
  const [viewEvent, setViewEvent] = useState<EventWithCategory | null>(null);
  const [editEvent, setEditEvent] = useState<(Partial<Event> & { isNew?: boolean }) | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["admin-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*, event_categories(name, icon)")
        .order("date", { ascending: false });
      if (error) throw error;
      return (data || []) as EventWithCategory[];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["admin-categories-list"],
    queryFn: async () => {
      const { data } = await supabase.from("event_categories").select("id, name");
      return data || [];
    },
  });

  const { data: registrations = [] } = useQuery({
    queryKey: ["event-registrations", viewEvent?.id],
    enabled: !!viewEvent,
    queryFn: async () => {
      const { data } = await supabase
        .from("event_registrations")
        .select("id, status, checked_in")
        .eq("event_id", viewEvent!.id);
      return data || [];
    },
  });

  const { data: meetingPoints = [] } = useQuery({
    queryKey: ["event-meeting-points", viewEvent?.id],
    enabled: !!viewEvent,
    queryFn: async () => {
      const { data } = await supabase
        .from("event_meeting_points")
        .select("*")
        .eq("event_id", viewEvent!.id)
        .order("sort_order");
      return data || [];
    },
  });

  const uploadImage = async (file: File, eventId: string): Promise<string> => {
    const ext = file.name.split(".").pop();
    const filePath = `${eventId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("event-images").upload(filePath, file, { upsert: true });
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from("event-images").getPublicUrl(filePath);
    return publicUrl;
  };

  const saveMutation = useMutation({
    mutationFn: async (evt: any) => {
      const { isNew, event_categories, ...data } = evt;
      let savedId = data.id;

      if (isNew) {
        const { data: inserted, error } = await supabase.from("events").insert(data).select("id").single();
        if (error) throw error;
        savedId = inserted.id;
      } else {
        const { error } = await supabase.from("events").update({ ...data, updated_at: new Date().toISOString() }).eq("id", data.id);
        if (error) throw error;
      }

      // Upload image if selected
      if (imageFile && savedId) {
        setUploading(true);
        try {
          const publicUrl = await uploadImage(imageFile, savedId);
          await supabase.from("events").update({ image_url: publicUrl, updated_at: new Date().toISOString() }).eq("id", savedId);
        } finally {
          setUploading(false);
        }
      }
    },
    onSuccess: () => {
      toast.success("Event saved");
      queryClient.invalidateQueries({ queryKey: ["admin-events"] });
      setEditEvent(null);
      setImageFile(null);
      setImagePreview(null);
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

  const checkedInCount = registrations.filter(r => r.checked_in).length;
  const activeRegs = registrations.filter(r => r.status === "registered" || r.status === "paid").length;
  const waitlistCount = registrations.filter(r => r.status === "waitlist").length;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const openEdit = (event?: EventWithCategory) => {
    if (event) {
      setEditEvent(event);
      setImagePreview(getImageUrl(event.image_url));
    } else {
      setEditEvent({ ...emptyEvent });
      setImagePreview(null);
    }
    setImageFile(null);
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (editEvent) {
      setEditEvent({ ...editEvent, image_url: null });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Events</h1>
          <p className="text-muted-foreground mt-1">Manage all events ({events.length} total)</p>
        </div>
        <Button className="gap-2" onClick={() => openEdit()}>
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
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
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
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((event) => {
                  const imgSrc = getImageUrl(event.image_url);
                  return (
                    <TableRow
                      key={event.id}
                      className="cursor-pointer group"
                      onClick={() => setViewEvent(event)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-14 rounded-md overflow-hidden bg-muted flex-shrink-0">
                            {imgSrc ? (
                              <img src={imgSrc} alt={event.title} className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                                <Mountain className="h-4 w-4" />
                              </div>
                            )}
                          </div>
                          <span className="font-medium group-hover:text-primary transition-colors">{event.title}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{event.organizer_name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{event.event_categories?.name || "—"}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{event.date}</TableCell>
                      <TableCell>{event.spots_taken}/{event.spots_total}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusColors[event.status] || ""}>{event.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEdit(event); }}>
                                <Edit2 className="h-4 w-4 mr-2" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); if (confirm("Delete this event?")) deleteMutation.mutate(event.id); }}>
                                <Trash2 className="h-4 w-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
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
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {viewEvent && (() => {
            const viewImgSrc = getImageUrl(viewEvent.image_url);
            return (
              <>
                {viewImgSrc && (
                  <div className="w-full h-48 rounded-lg overflow-hidden -mt-2 mb-2">
                    <img src={viewImgSrc} alt={viewEvent.title} className="w-full h-full object-cover" />
                  </div>
                )}

                <DialogHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <DialogTitle className="text-xl">{viewEvent.title}</DialogTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {viewEvent.event_categories?.name && (
                          <Badge variant="secondary" className="mr-2">{viewEvent.event_categories.name}</Badge>
                        )}
                        <Badge variant="outline" className={statusColors[viewEvent.status] || ""}>{viewEvent.status}</Badge>
                        {viewEvent.featured && <Badge className="ml-2 bg-accent text-accent-foreground">Featured</Badge>}
                      </p>
                    </div>
                  </div>
                </DialogHeader>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{viewEvent.date}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{viewEvent.time}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{viewEvent.location}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>{viewEvent.spots_taken}/{viewEvent.spots_total} spots</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span>{viewEvent.price > 0 ? `€${viewEvent.price}` : "Free"} ({paymentLabels[viewEvent.payment_type]})</span>
                  </div>
                  {viewEvent.duration && (
                    <div className="flex items-center gap-2 text-sm">
                      <Timer className="h-4 w-4 text-muted-foreground" />
                      <span>{viewEvent.duration}</span>
                    </div>
                  )}
                </div>

                {(viewEvent.difficulty || viewEvent.distance || viewEvent.elevation) && (
                  <>
                    <Separator className="my-3" />
                    <div className="space-y-1">
                      <h4 className="text-sm font-semibold">Trail Details</h4>
                      <div className="grid grid-cols-3 gap-3 text-sm">
                        {viewEvent.difficulty && (
                          <div className="bg-muted/50 rounded-md p-2 text-center">
                            <p className="text-muted-foreground text-xs">Difficulty</p>
                            <p className="font-medium capitalize">{viewEvent.difficulty}</p>
                          </div>
                        )}
                        {viewEvent.distance && (
                          <div className="bg-muted/50 rounded-md p-2 text-center">
                            <p className="text-muted-foreground text-xs">Distance</p>
                            <p className="font-medium">{viewEvent.distance}</p>
                          </div>
                        )}
                        {viewEvent.elevation && (
                          <div className="bg-muted/50 rounded-md p-2 text-center">
                            <p className="text-muted-foreground text-xs">Elevation</p>
                            <p className="font-medium">{viewEvent.elevation}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {viewEvent.description && (
                  <>
                    <Separator className="my-3" />
                    <div>
                      <h4 className="text-sm font-semibold mb-1">Description</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{viewEvent.description}</p>
                    </div>
                  </>
                )}

                <Separator className="my-3" />
                <div>
                  <h4 className="text-sm font-semibold mb-1">Organizer</h4>
                  <p className="text-sm text-muted-foreground">{viewEvent.organizer_name}</p>
                </div>

                <Separator className="my-3" />
                <div>
                  <h4 className="text-sm font-semibold mb-2">Registrations</h4>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div className="bg-muted/50 rounded-md p-2 text-center">
                      <p className="text-muted-foreground text-xs">Active</p>
                      <p className="font-semibold text-lg">{activeRegs}</p>
                    </div>
                    <div className="bg-muted/50 rounded-md p-2 text-center">
                      <p className="text-muted-foreground text-xs">Waitlist</p>
                      <p className="font-semibold text-lg">{waitlistCount}</p>
                    </div>
                    <div className="bg-muted/50 rounded-md p-2 text-center">
                      <p className="text-muted-foreground text-xs">Checked In</p>
                      <p className="font-semibold text-lg">{checkedInCount}</p>
                    </div>
                  </div>
                </div>

                {meetingPoints.length > 0 && (
                  <>
                    <Separator className="my-3" />
                    <div>
                      <h4 className="text-sm font-semibold mb-2">Meeting Points</h4>
                      <div className="space-y-2">
                        {meetingPoints.map((mp) => (
                          <div key={mp.id} className="flex items-start gap-3 bg-muted/50 rounded-md p-2 text-sm">
                            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="font-medium">{mp.name} — {mp.time}</p>
                              <p className="text-muted-foreground">{mp.location}</p>
                              {mp.notes && <p className="text-muted-foreground text-xs mt-1">{mp.notes}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {(viewEvent.deposit || viewEvent.cancellation_policy) && (
                  <>
                    <Separator className="my-3" />
                    <div className="space-y-2 text-sm">
                      {viewEvent.deposit && <p><strong>Deposit:</strong> €{viewEvent.deposit}</p>}
                      {viewEvent.cancellation_policy && (
                        <div>
                          <h4 className="text-sm font-semibold mb-1">Cancellation Policy</h4>
                          <p className="text-muted-foreground">{viewEvent.cancellation_policy}</p>
                        </div>
                      )}
                    </div>
                  </>
                )}

                <Separator className="my-3" />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setViewEvent(null)}>Close</Button>
                  <Button onClick={() => { openEdit(viewEvent); setViewEvent(null); }}>
                    <Edit2 className="h-4 w-4 mr-2" /> Edit Event
                  </Button>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Edit/Create Dialog - All Fields */}
      <Dialog open={!!editEvent} onOpenChange={(o) => { if (!o) { setEditEvent(null); setImageFile(null); setImagePreview(null); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editEvent?.isNew ? "Create Event" : "Edit Event"}</DialogTitle></DialogHeader>
          {editEvent && (
            <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
              {/* Image Upload */}
              <div>
                <Label>Event Image</Label>
                <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleFileSelect} />
                {imagePreview ? (
                  <div className="relative mt-2 rounded-lg overflow-hidden h-40 bg-muted">
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    <div className="absolute top-2 right-2 flex gap-1">
                      <Button size="icon" variant="secondary" className="h-8 w-8" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="destructive" className="h-8 w-8" onClick={removeImage}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="mt-2 border-2 border-dashed border-muted-foreground/25 rounded-lg h-32 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Click to upload image</p>
                    <p className="text-xs text-muted-foreground">Max 5MB</p>
                  </div>
                )}
              </div>

              {/* Title */}
              <div>
                <Label>Title</Label>
                <Input value={editEvent.title || ""} onChange={(e) => setEditEvent({ ...editEvent, title: e.target.value })} />
              </div>

              {/* Location */}
              <div>
                <Label>Location</Label>
                <Input value={editEvent.location || ""} onChange={(e) => setEditEvent({ ...editEvent, location: e.target.value })} />
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Date</Label><Input type="date" value={editEvent.date || ""} onChange={(e) => setEditEvent({ ...editEvent, date: e.target.value })} /></div>
                <div><Label>Time</Label><Input type="time" value={editEvent.time || ""} onChange={(e) => setEditEvent({ ...editEvent, time: e.target.value })} /></div>
              </div>

              {/* Organizer */}
              <div>
                <Label>Organizer Name</Label>
                <Input value={editEvent.organizer_name || ""} onChange={(e) => setEditEvent({ ...editEvent, organizer_name: e.target.value })} />
              </div>

              {/* Spots & Price */}
              <div className="grid grid-cols-3 gap-4">
                <div><Label>Total Spots</Label><Input type="number" value={editEvent.spots_total ?? 20} onChange={(e) => setEditEvent({ ...editEvent, spots_total: parseInt(e.target.value) || 0 })} /></div>
                <div><Label>Price (€)</Label><Input type="number" step="0.01" value={editEvent.price ?? 0} onChange={(e) => setEditEvent({ ...editEvent, price: parseFloat(e.target.value) || 0 })} /></div>
                <div><Label>Deposit (€)</Label><Input type="number" step="0.01" value={editEvent.deposit ?? ""} onChange={(e) => setEditEvent({ ...editEvent, deposit: e.target.value ? parseFloat(e.target.value) : null })} placeholder="Optional" /></div>
              </div>

              {/* Status, Category, Payment Type */}
              <div className="grid grid-cols-3 gap-4">
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
                <div>
                  <Label>Payment Type</Label>
                  <Select value={editEvent.payment_type || "free"} onValueChange={(v) => setEditEvent({ ...editEvent, payment_type: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Free</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="deposit">Deposit</SelectItem>
                      <SelectItem value="location">Pay at location</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Trail Details */}
              <Separator />
              <h4 className="text-sm font-semibold">Trail Details (optional)</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Difficulty</Label>
                  <Select value={editEvent.difficulty || "none"} onValueChange={(v) => setEditEvent({ ...editEvent, difficulty: v === "none" ? null : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="facile">Facile</SelectItem>
                      <SelectItem value="moderato">Moderato</SelectItem>
                      <SelectItem value="impegnativo">Impegnativo</SelectItem>
                      <SelectItem value="esperto">Esperto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Duration</Label><Input value={editEvent.duration || ""} onChange={(e) => setEditEvent({ ...editEvent, duration: e.target.value || null })} placeholder="e.g. 3h" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Distance</Label><Input value={editEvent.distance || ""} onChange={(e) => setEditEvent({ ...editEvent, distance: e.target.value || null })} placeholder="e.g. 12 km" /></div>
                <div><Label>Elevation</Label><Input value={editEvent.elevation || ""} onChange={(e) => setEditEvent({ ...editEvent, elevation: e.target.value || null })} placeholder="e.g. 500 m" /></div>
              </div>

              {/* Featured */}
              <div className="flex items-center justify-between">
                <Label>Featured Event</Label>
                <Switch checked={editEvent.featured || false} onCheckedChange={(v) => setEditEvent({ ...editEvent, featured: v })} />
              </div>

              {/* Description */}
              <div>
                <Label>Description</Label>
                <Textarea value={editEvent.description || ""} onChange={(e) => setEditEvent({ ...editEvent, description: e.target.value })} rows={4} />
              </div>

              {/* Cancellation Policy */}
              <div>
                <Label>Cancellation Policy</Label>
                <Textarea value={editEvent.cancellation_policy || ""} onChange={(e) => setEditEvent({ ...editEvent, cancellation_policy: e.target.value || null })} rows={2} placeholder="Optional" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditEvent(null); setImageFile(null); setImagePreview(null); }}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate(editEvent)} disabled={saveMutation.isPending || uploading}>
              {saveMutation.isPending || uploading ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
