import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Archive, Copy, GripVertical, Pencil, Target, Trash2 } from "lucide-react";
import { useState } from "react";
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
  onReorder: (missions: MissionEnriched[]) => void;
  isReordering?: boolean;
}

const reorderMissions = (missions: MissionEnriched[], draggedId: string, targetId: string) => {
  const sourceIndex = missions.findIndex((mission) => mission.id === draggedId);
  const targetIndex = missions.findIndex((mission) => mission.id === targetId);

  if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) {
    return missions;
  }

  const next = [...missions];
  const [draggedMission] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, draggedMission);
  return next;
};

export default function MissionsTable({ missions, onEdit, onDelete, onDuplicate, onArchive, onReorder, isReordering = false }: Props) {
  const [draggedMissionId, setDraggedMissionId] = useState<string | null>(null);
  const [dragOverMissionId, setDragOverMissionId] = useState<string | null>(null);

  return (
    <div className="overflow-hidden">
      <Table className="table-fixed text-xs sm:text-sm">
        <colgroup>
          <col className="w-[31%]" />
          <col className="w-[12%]" />
          <col className="w-[16%]" />
          <col className="w-[12%]" />
          <col className="w-[10%]" />
          <col className="w-[12%]" />
          <col className="w-[7%]" />
        </colgroup>
        <TableHeader>
          <TableRow>
            <TableHead className="px-2 py-3 sm:px-3">Missione</TableHead>
            <TableHead className="px-2 py-3 sm:px-3">Stato</TableHead>
            <TableHead className="px-2 py-3 sm:px-3">Regola</TableHead>
            <TableHead className="px-2 py-3 sm:px-3">Ricompensa</TableHead>
            <TableHead className="px-2 py-3 sm:px-3">Performance</TableHead>
            <TableHead className="px-2 py-3 sm:px-3">Date</TableHead>
            <TableHead className="px-1 py-3">Azioni</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {missions.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                <Target className="mx-auto mb-2 h-8 w-8 opacity-50" />
                Nessuna missione. Creane una per iniziare.
              </TableCell>
            </TableRow>
          ) : (
            missions.map((mission) => {
              const primaryCondition = mission.conditions[0];
              return (
                <TableRow
                  key={mission.id}
                  className={dragOverMissionId === mission.id ? "bg-muted/70" : undefined}
                  onDragOver={(event) => {
                    if (!draggedMissionId || draggedMissionId === mission.id || isReordering) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    if (dragOverMissionId !== mission.id) {
                      setDragOverMissionId(mission.id);
                    }
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (!draggedMissionId || draggedMissionId === mission.id || isReordering) {
                      setDraggedMissionId(null);
                      setDragOverMissionId(null);
                      return;
                    }

                    const reordered = reorderMissions(missions, draggedMissionId, mission.id);
                    setDraggedMissionId(null);
                    setDragOverMissionId(null);
                    onReorder(reordered);
                  }}
                  onDragEnd={() => {
                    setDraggedMissionId(null);
                    setDragOverMissionId(null);
                  }}
                >
                  <TableCell className="px-2 py-3 sm:px-3">
                    <div className="flex min-w-0 items-start gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 cursor-grab active:cursor-grabbing"
                        draggable={!isReordering}
                        disabled={isReordering}
                        aria-label={`Riordina ${mission.title}`}
                        onDragStart={(event) => {
                          setDraggedMissionId(mission.id);
                          setDragOverMissionId(mission.id);
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/plain", mission.id);
                        }}
                      >
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <div className="mt-0.5 shrink-0 rounded-lg border border-border bg-muted/30 p-1.5">
                        <div
                          className="rounded-md p-1"
                          style={{
                            background: mission.icon_background || undefined,
                            color: mission.icon_color || undefined,
                          }}
                        >
                          <DynamicIcon value={mission.icon || "lucide:Target"} size={18} className={mission.icon_color ? "text-current" : ""} />
                        </div>
                      </div>
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="break-words font-medium leading-snug">{mission.title}</p>
                          {mission.featured && <Badge variant="outline">Featured</Badge>}
                          {mission.visibility === "secret" && <Badge variant="secondary">Secret</Badge>}
                          {mission.campaign?.name && <Badge variant="secondary">{mission.campaign.name}</Badge>}
                        </div>
                        <p className="break-words text-xs leading-snug text-muted-foreground">{mission.description}</p>
                        {mission.internal_name && <p className="break-words text-[11px] leading-snug text-muted-foreground">ID admin: {mission.internal_name}</p>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-2 py-3 sm:px-3">
                    <div className="space-y-1.5">
                      <Badge variant="outline" className={`max-w-full whitespace-normal break-words text-center leading-tight ${statusVariant[mission.status] || ""}`}>
                        {mission.status}
                      </Badge>
                      <Badge variant="secondary" className="max-w-full whitespace-normal break-words text-center leading-tight">{typeLabel(mission.type)}</Badge>
                    </div>
                  </TableCell>
                  <TableCell className="px-2 py-3 sm:px-3">
                    <div className="space-y-1">
                      <div className="break-words leading-snug">{primaryCondition ? actionLabel(primaryCondition.target_action) : "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {mission.conditions_logic === "all" ? "AND" : "OR"} · {mission.conditions.length} condizioni
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="break-words px-2 py-3 leading-snug sm:px-3">{rewardSummary(mission.rewards)}</TableCell>
                  <TableCell className="px-2 py-3 sm:px-3">
                    <div className="space-y-1 leading-snug">
                      <div className="font-medium">{mission.analytics.completedUsers}</div>
                      <div className="text-xs text-muted-foreground">{mission.analytics.completionRate}% tasso</div>
                    </div>
                  </TableCell>
                  <TableCell className="px-2 py-3 text-xs text-muted-foreground sm:px-3">
                    <div className="space-y-1 leading-snug">
                      <div>{mission.starts_at ? new Date(mission.starts_at).toLocaleDateString("it-IT") : "Subito"}</div>
                      <div>{mission.ends_at ? new Date(mission.ends_at).toLocaleDateString("it-IT") : "Senza scadenza"}</div>
                      <div className="pt-1 text-[11px]">Agg. {new Date(mission.updated_at).toLocaleString("it-IT")}</div>
                    </div>
                  </TableCell>
                  <TableCell className="px-1 py-3">
                    <div className="grid grid-cols-2 gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(mission)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDuplicate(mission)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onArchive(mission)}>
                        <Archive className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDelete(mission.id)}>
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
