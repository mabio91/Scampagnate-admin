import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Archive, Copy, Pencil, Target, Trash2 } from "lucide-react";
import DynamicIcon from "@/components/DynamicIcon";
import type { MissionEnriched } from "./missionBuilder";
import { actionLabel, rewardSummary, typeLabel } from "./missionBuilder";

const statusVariant: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  inactive: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  draft: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  archived: "bg-muted text-muted-foreground border-border",
};

interface Props {
  missions: MissionEnriched[];
  onEdit: (mission: MissionEnriched) => void;
  onDelete: (id: string) => void;
  onDuplicate: (mission: MissionEnriched) => void;
  onArchive: (mission: MissionEnriched) => void;
}

export default function MissionsTable({ missions, onEdit, onDelete, onDuplicate, onArchive }: Props) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Missione</TableHead>
            <TableHead>Stato</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Azione principale</TableHead>
            <TableHead>Ricompensa</TableHead>
            <TableHead>Date attive</TableHead>
            <TableHead>Completamenti</TableHead>
            <TableHead>Tasso</TableHead>
            <TableHead>Ultimo aggiornamento</TableHead>
            <TableHead className="w-28">Azioni</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {missions.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="py-12 text-center text-muted-foreground">
                <Target className="mx-auto mb-2 h-8 w-8 opacity-50" />
                Nessuna missione. Creane una per iniziare.
              </TableCell>
            </TableRow>
          ) : (
            missions.map((mission) => {
              const primaryCondition = mission.conditions[0];
              return (
                <TableRow key={mission.id}>
                  <TableCell>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-xl border border-border bg-muted/30 p-2">
                        <DynamicIcon value={mission.icon || "lucide:Target"} size={18} />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{mission.title}</p>
                          {mission.featured && <Badge variant="outline">Featured</Badge>}
                          {mission.visibility === "secret" && <Badge variant="secondary">Secret</Badge>}
                        </div>
                        <p className="max-w-[260px] truncate text-xs text-muted-foreground">{mission.description}</p>
                        {mission.internal_name && <p className="text-[11px] text-muted-foreground">ID admin: {mission.internal_name}</p>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusVariant[mission.status] || ""}>
                      {mission.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{typeLabel(mission.type)}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    <div className="space-y-1">
                      <div>{primaryCondition ? actionLabel(primaryCondition.target_action) : "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {mission.conditions_logic === "all" ? "AND" : "OR"} · {mission.conditions.length} condizioni
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{rewardSummary(mission.rewards)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    <div>{mission.starts_at ? new Date(mission.starts_at).toLocaleDateString("it-IT") : "Subito"}</div>
                    <div>{mission.ends_at ? new Date(mission.ends_at).toLocaleDateString("it-IT") : "Senza scadenza"}</div>
                  </TableCell>
                  <TableCell className="font-medium">{mission.analytics.completedUsers}</TableCell>
                  <TableCell>{mission.analytics.completionRate}%</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(mission.updated_at).toLocaleString("it-IT")}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => onEdit(mission)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => onDuplicate(mission)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => onArchive(mission)}>
                        <Archive className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => onDelete(mission.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
