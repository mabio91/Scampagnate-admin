import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pencil, Trash2, Target, Gift, Ticket, Award } from "lucide-react";

const typeLabels: Record<string, string> = {
  weekly: "Settimanale",
  monthly: "Mensile",
  one_time: "Una tantum",
  progressive: "Progressiva",
  streak: "Streak",
};

const rewardIcons: Record<string, React.ReactNode> = {
  coupon: <Ticket className="h-3.5 w-3.5" />,
  badge: <Award className="h-3.5 w-3.5" />,
  physical: <Gift className="h-3.5 w-3.5" />,
};

interface Props {
  missions: any[];
  onEdit: (m: any) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, active: boolean) => void;
}

export default function MissionsTable({ missions, onEdit, onDelete, onToggle }: Props) {
  return (
    <div className="overflow-x-auto">
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
                  <Badge variant="secondary" className="text-xs">
                    {typeLabels[m.type] || m.type}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-sm">{m.target_value}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <span className="text-primary font-medium">+{m.reward_points} pt</span>
                    {m.reward_type !== "points" && rewardIcons[m.reward_type] && (
                      <span className="flex items-center gap-0.5 text-muted-foreground">
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
    </div>
  );
}
