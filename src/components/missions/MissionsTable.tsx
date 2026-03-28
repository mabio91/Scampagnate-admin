import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pencil, Trash2, Target, Gift, Ticket, Award } from "lucide-react";
import { MissionForm } from "./MissionFormDialog";

const typeLabels: Record<string, string> = {
  weekly: "Settimanale",
  monthly: "Mensile",
  one_time: "Una tantum",
  progressive: "Progressiva",
  streak: "Streak",
  category: "Per categoria",
};

const typeColors: Record<string, string> = {
  weekly: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  monthly: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  one_time: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  progressive: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  streak: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  category: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

const rewardIcons: Record<string, React.ReactNode> = {
  coupon: <Ticket className="h-3.5 w-3.5 text-amber-500" />,
  badge: <Award className="h-3.5 w-3.5 text-blue-500" />,
  physical: <Gift className="h-3.5 w-3.5 text-green-500" />,
};

interface Props {
  missions: any[];
  onEdit: (m: any) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, active: boolean) => void;
}

export default function MissionsTable({ missions, onEdit, onDelete, onToggle }: Props) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Missione</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Obiettivo</TableHead>
          <TableHead>Ricompensa</TableHead>
          <TableHead>Scadenza</TableHead>
          <TableHead>Stato</TableHead>
          <TableHead className="w-20">Azioni</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {missions.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
              <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
              Nessuna missione. Creane una per iniziare.
            </TableCell>
          </TableRow>
        ) : (
          missions.map((m: any) => (
            <TableRow key={m.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span className="text-xl">{m.icon || "🎯"}</span>
                  <div>
                    <p className="font-medium">{m.title}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[200px]">{m.description}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${typeColors[m.type] || typeColors.one_time}`}>
                  {typeLabels[m.type] || m.type}
                </span>
              </TableCell>
              <TableCell className="font-mono text-sm">{m.target_value}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5">
                  <span className="text-primary font-medium">+{m.reward_points} pt</span>
                  {m.reward_type !== "points" && rewardIcons[m.reward_type] && (
                    <span className="flex items-center gap-0.5">
                      {rewardIcons[m.reward_type]}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                {m.expires_at ? (
                  <span className="text-xs text-muted-foreground">
                    {new Date(m.expires_at).toLocaleDateString("it-IT")}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                <Switch
                  checked={m.is_active}
                  onCheckedChange={(checked) => onToggle(m.id, checked)}
                />
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => onEdit(m)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => onDelete(m.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
