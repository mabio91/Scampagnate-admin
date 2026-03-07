import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, MoreHorizontal, Eye, Edit2, Trash2, Plus } from "lucide-react";
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

const emptyEvent = {
  title: "", description: "", location: "", date: "", time: "09:00",
  spots_total: 20, price: 0, payment_type: "free" as const,
  status: "available" as const, organizer_name: "", category_id: null as string | null,
};

export default function EventsPage() {
  const [search, setSearch] = useState("");
  const [viewEvent, setViewEvent] = useState<Event | null>(null);
  const [editEvent, setEditEvent] = useState<(Partial<Event> & { isNew?: boolean }) | null>(null);
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
              <p><strong>Description:</strong> {viewEvent.description || "—"}</p>
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
              <div><Label>Description</Label><Textarea value={editEvent.description || ""} onChange={(e) => setEditEvent({ ...editEvent, description: e.target.value })} rows={3} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditEvent(null)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate(editEvent)} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
