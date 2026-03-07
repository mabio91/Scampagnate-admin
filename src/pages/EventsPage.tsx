import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, MoreHorizontal, Eye, Edit2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const mockEvents = [
  { id: 1, title: "Trekking Monte Bianco", organizer: "Escursioni Toscana", category: "Trekking", date: "2025-04-15", participants: 32, status: "active" },
  { id: 2, title: "Ciclismo Chianti", organizer: "Festival Milano", category: "Ciclismo", date: "2025-04-20", participants: 18, status: "active" },
  { id: 3, title: "Campeggio Lago Garda", organizer: "Natura Piemonte", category: "Campeggio", date: "2025-05-01", participants: 45, status: "draft" },
  { id: 4, title: "Orienteering Foresta Nera", organizer: "Trek Dolomiti", category: "Orienteering", date: "2025-05-10", participants: 12, status: "cancelled" },
  { id: 5, title: "Escursione Cinque Terre", organizer: "Escursioni Toscana", category: "Escursionismo", date: "2025-05-18", participants: 28, status: "active" },
  { id: 6, title: "Pesca Sportiva Sardegna", organizer: "Lago di Como Tours", category: "Pesca", date: "2025-06-02", participants: 8, status: "active" },
];

export default function EventsPage() {
  const [search, setSearch] = useState("");
  const filtered = mockEvents.filter((e) => e.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Events</h1>
        <p className="text-muted-foreground mt-1">View and manage all events</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search events..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Organizer</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Participants</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((event) => (
                <TableRow key={event.id}>
                  <TableCell className="font-medium">{event.title}</TableCell>
                  <TableCell className="text-muted-foreground">{event.organizer}</TableCell>
                  <TableCell><Badge variant="secondary">{event.category}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{event.date}</TableCell>
                  <TableCell>{event.participants}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={event.status === "active" ? "text-success border-success/30" : event.status === "draft" ? "text-warning border-warning/30" : "text-destructive border-destructive/30"}>
                      {event.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem><Eye className="h-4 w-4 mr-2" /> View</DropdownMenuItem>
                        <DropdownMenuItem><Edit2 className="h-4 w-4 mr-2" /> Edit</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">Cancel Event</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
