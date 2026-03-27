import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Save, Mountain } from "lucide-react";

interface DifficultyLevel {
  id: string;
  level_number: number;
  label: string;
  icon: string;
  color_primary: string;
  color_background: string;
  color_border: string;
  color_icon: string;
}

export default function TrekkingDifficultyPage() {
  const queryClient = useQueryClient();
  const [edited, setEdited] = useState<Record<string, Partial<DifficultyLevel>>>({});

  const { data: levels = [], isLoading } = useQuery({
    queryKey: ["trekking-difficulty-levels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trekking_difficulty_levels")
        .select("*")
        .order("level_number");
      if (error) throw error;
      return data as DifficultyLevel[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      for (const [id, changes] of Object.entries(edited)) {
        const { error } = await supabase
          .from("trekking_difficulty_levels")
          .update({ ...changes, updated_at: new Date().toISOString() })
          .eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trekking-difficulty-levels"] });
      setEdited({});
      toast.success("Livelli di difficoltà salvati");
    },
    onError: () => toast.error("Errore nel salvataggio"),
  });

  const getVal = (level: DifficultyLevel, field: keyof DifficultyLevel) =>
    edited[level.id]?.[field] ?? level[field];

  const setField = (id: string, field: keyof DifficultyLevel, value: string) =>
    setEdited((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));

  const hasChanges = Object.keys(edited).length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Mountain className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Livelli Difficoltà Trekking</h1>
            <p className="text-sm text-muted-foreground">Gestisci i 5 livelli di difficoltà per gli eventi</p>
          </div>
        </div>
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={!hasChanges || saveMutation.isPending}
          className="gap-2"
        >
          <Save className="h-4 w-4" />
          {saveMutation.isPending ? "Salvataggio..." : "Salva modifiche"}
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Caricamento...</p>
      ) : (
        <div className="grid gap-4">
          {levels.map((level) => (
            <Card key={level.id} className="border-l-4" style={{ borderLeftColor: getVal(level, "color_primary") as string }}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="text-xl">{getVal(level, "icon")}</span>
                  <span>Livello {level.level_number}</span>
                  <span className="text-muted-foreground">—</span>
                  <span>{getVal(level, "label")}</span>
                  {/* Live preview badge */}
                  <span
                    className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                    style={{
                      backgroundColor: getVal(level, "color_background") as string,
                      color: getVal(level, "color_primary") as string,
                      border: `1px solid ${getVal(level, "color_border")}`,
                    }}
                  >
                    <span>{getVal(level, "icon")}</span>
                    {getVal(level, "label")}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Etichetta pubblica</Label>
                    <Input
                      value={getVal(level, "label") as string}
                      onChange={(e) => setField(level.id, "label", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Icona (emoji)</Label>
                    <Input
                      value={getVal(level, "icon") as string}
                      onChange={(e) => setField(level.id, "icon", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Colore primario</Label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={getVal(level, "color_primary") as string}
                        onChange={(e) => setField(level.id, "color_primary", e.target.value)}
                        className="h-10 w-10 rounded border border-input cursor-pointer"
                      />
                      <Input
                        value={getVal(level, "color_primary") as string}
                        onChange={(e) => setField(level.id, "color_primary", e.target.value)}
                        className="font-mono text-xs"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Colore sfondo badge</Label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={getVal(level, "color_background") as string}
                        onChange={(e) => setField(level.id, "color_background", e.target.value)}
                        className="h-10 w-10 rounded border border-input cursor-pointer"
                      />
                      <Input
                        value={getVal(level, "color_background") as string}
                        onChange={(e) => setField(level.id, "color_background", e.target.value)}
                        className="font-mono text-xs"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Colore bordo</Label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={getVal(level, "color_border") as string}
                        onChange={(e) => setField(level.id, "color_border", e.target.value)}
                        className="h-10 w-10 rounded border border-input cursor-pointer"
                      />
                      <Input
                        value={getVal(level, "color_border") as string}
                        onChange={(e) => setField(level.id, "color_border", e.target.value)}
                        className="font-mono text-xs"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Colore icona</Label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={getVal(level, "color_icon") as string}
                        onChange={(e) => setField(level.id, "color_icon", e.target.value)}
                        className="h-10 w-10 rounded border border-input cursor-pointer"
                      />
                      <Input
                        value={getVal(level, "color_icon") as string}
                        onChange={(e) => setField(level.id, "color_icon", e.target.value)}
                        className="font-mono text-xs"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
