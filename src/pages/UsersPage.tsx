import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, MoreHorizontal, UserPlus, Ban, CheckCircle } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const mockUsers = [
  { id: 1, name: "Marco Rossi", email: "marco@email.com", role: "user", status: "active", joined: "2024-01-15", events: 12 },
  { id: 2, name: "Anna Verdi", email: "anna@email.com", role: "user", status: "active", joined: "2024-02-20", events: 8 },
  { id: 3, name: "Luca Bianchi", email: "luca@email.com", role: "organizer", status: "active", joined: "2024-03-10", events: 24 },
  { id: 4, name: "Sofia Russo", email: "sofia@email.com", role: "user", status: "suspended", joined: "2024-04-05", events: 3 },
  { id: 5, name: "Giuseppe Conti", email: "giuseppe@email.com", role: "user", status: "active", joined: "2024-05-18", events: 15 },
  { id: 6, name: "Elena Moretti", email: "elena@email.com", role: "organizer", status: "active", joined: "2024-06-22", events: 31 },
  { id: 7, name: "Davide Ferrara", email: "davide@email.com", role: "user", status: "inactive", joined: "2024-01-08", events: 0 },
];

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const filtered = mockUsers.filter((u) => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Users</h1>
          <p className="text-muted-foreground mt-1">Manage platform users</p>
        </div>
        <Button className="gap-2">
          <UserPlus className="h-4 w-4" /> Add User
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Events</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell className="text-muted-foreground">{user.email}</TableCell>
                  <TableCell>
                    <Badge variant={user.role === "organizer" ? "default" : "secondary"}>{user.role}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={user.status === "active" ? "text-success border-success/30" : user.status === "suspended" ? "text-destructive border-destructive/30" : "text-muted-foreground"}>
                      {user.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{user.events}</TableCell>
                  <TableCell className="text-muted-foreground">{user.joined}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>View Profile</DropdownMenuItem>
                        <DropdownMenuItem>Edit</DropdownMenuItem>
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
