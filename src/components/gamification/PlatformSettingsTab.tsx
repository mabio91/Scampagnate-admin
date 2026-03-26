import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Save } from "lucide-react";

export default function PlatformSettingsTab() {
  const queryClient = useQueryClient();
  const [edited, setEdited] = useState<Record<string, string>>({});

  const { data: settings = [] } = useQuery({
    queryKey: ["platform-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("platform_settings").select("*").order("key");
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      for (const [id, value] of Object.entries(edited)) {
        const { error } = await supabase
          .from("platform_settings")
          .update({ value, updated_at: new Date().toISOString() })
          .eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-settings"] });
      setEdited({});
      toast.success("Impostazioni salvate");
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Impostazioni Piattaforma</CardTitle>
        <Button
          size="sm"
          onClick={() => saveMutation.mutate()}
          disabled={Object.keys(edited).length === 0 || saveMutation.isPending}
          className="gap-2"
        >
          <Save className="h-4 w-4" /> Salva
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {settings.map((s: any) => (
          <div key={s.id} className="space-y-1.5">
            <Label className="text-sm font-medium">{s.label || s.key}</Label>
            <Input
              value={edited[s.id] !== undefined ? edited[s.id] : s.value}
              onChange={(e) => setEdited((prev) => ({ ...prev, [s.id]: e.target.value }))}
            />
            {s.description && (
              <p className="text-xs text-muted-foreground">{s.description}</p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
