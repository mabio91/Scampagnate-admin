import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Edit2, Trash2, Mountain, Bike, Trees, Tent, Compass, Fish } from "lucide-react";

const mockCategories = [
  { id: 1, name: "Trekking", icon: Mountain, events: 89, color: "bg-primary/10 text-primary" },
  { id: 2, name: "Ciclismo", icon: Bike, events: 45, color: "bg-secondary/20 text-secondary" },
  { id: 3, name: "Escursionismo", icon: Trees, events: 67, color: "bg-success/10 text-success" },
  { id: 4, name: "Campeggio", icon: Tent, events: 23, color: "bg-accent/20 text-accent" },
  { id: 5, name: "Orienteering", icon: Compass, events: 12, color: "bg-warning/10 text-warning" },
  { id: 6, name: "Pesca", icon: Fish, events: 18, color: "bg-muted text-muted-foreground" },
];

export default function CategoriesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Event Categories</h1>
          <p className="text-muted-foreground mt-1">Manage event categories</p>
        </div>
        <Button className="gap-2"><Plus className="h-4 w-4" /> Add Category</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {mockCategories.map((cat) => (
          <Card key={cat.id} className="hover:shadow-md transition-shadow group">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-lg ${cat.color}`}>
                    <cat.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold font-sans">{cat.name}</h3>
                    <p className="text-sm text-muted-foreground">{cat.events} events</p>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-8 w-8"><Edit2 className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
