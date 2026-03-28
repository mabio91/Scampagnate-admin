import { Card, CardContent } from "@/components/ui/card";

interface Props {
  missions: any[];
}

export default function MissionStatsCards({ missions }: Props) {
  const active = missions.filter((m) => m.is_active).length;
  const inactive = missions.filter((m) => !m.is_active).length;
  const withRewards = missions.filter((m) => m.reward_type !== "points").length;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card>
        <CardContent className="p-4 text-center">
          <div className="text-2xl font-bold text-primary">{missions.length}</div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Totale</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{active}</div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Attive</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 text-center">
          <div className="text-2xl font-bold text-muted-foreground">{inactive}</div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Disattive</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 text-center">
          <div className="text-2xl font-bold text-amber-600">{withRewards}</div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Con Reward</div>
        </CardContent>
      </Card>
    </div>
  );
}
