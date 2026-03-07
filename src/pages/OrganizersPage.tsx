import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, MoreHorizontal, Plus } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const mockOrganizers = [
  { id: 1, name: "Festival Milano", contact: "info@festivalmilano.it", status: "approved", events: 45, rating: 4.8 },
  { id: 2, name: "Escursioni Toscana", contact: "hello@escursioni.it", status: "approved", events: 32, rating: 4.6 },
  { id: 3, name: "Avventura Roma", contact: "team@avventuraroma.it", status: "pending", events: 0, rating: 0 },
  { id: 4, name: "Natura Piemonte", contact: "info@naturapiemonte.it", status: "approved", events: 18, rating: 4.3 },
  { id: 5, name: "Trek Dolomiti", contact: "trek@dolomiti.it", status: "suspended", events: 12, rating: 3.9 },
  { id: 6, name: "Lago di Como Tours", contact: "tours@comolake.it", status: "pending", events: 0, rating: 0 },
];

export default function OrganizersPage() {
  const [search, setSearch] = useState("");
  const filtered = mockOrganizers.filter((o) => o.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Organizers</h1>
          <p className="text-muted-foreground mt-1">Manage event organizers</p>
        </div>
        <Button className="gap-2"><Plus className="h-4 w-4" /> Add Organizer</Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search organizers..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Events</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((org) => (
                <TableRow key={org.id}>
                  <TableCell className="font-medium">{org.name}</TableCell>
                  <TableCell className="text-muted-foreground">{org.contact}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={org.status === "approved" ? "text-success border-success/30" : org.status === "pending" ? "text-warning border-warning/30" : "text-destructive border-destructive/30"}>
                      {org.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{org.events}</TableCell>
                  <TableCell>{org.rating > 0 ? `⭐ ${org.rating}` : "—"}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>View Details</DropdownMenuItem>
                        <DropdownMenuItem>Approve</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">Suspend</DropdownMenuItem>
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
