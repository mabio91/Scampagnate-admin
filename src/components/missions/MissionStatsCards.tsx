import { Card, CardContent } from "@/components/ui/card";
import type { MissionEnriched } from "./missionBuilder";

interface Props {
  missions: MissionEnriched[];
}

export default function MissionStatsCards({ missions }: Props) {
  const active = missions.filter((mission) => mission.status === "active").length;
  const drafts = missions.filter((mission) => mission.status === "draft").length;
  const featured = missions.filter((mission) => mission.featured).length;
  const avgCompletionRate = missions.length
    ? Math.round(missions.reduce((sum, mission) => sum + mission.analytics.completionRate, 0) / missions.length)
    : 0;

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <Card>
        <CardContent className="p-4 text-center">
          <div className="text-2xl font-bold text-primary">{missions.length}</div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Totale missioni</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 text-center">
          <div className="text-2xl font-bold text-emerald-500">{active}</div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Attive</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 text-center">
          <div className="text-2xl font-bold text-amber-500">{drafts}</div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Bozze</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 text-center">
          <div className="text-2xl font-bold text-sky-500">{avgCompletionRate}%</div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Tasso medio completamento</div>
        </CardContent>
      </Card>
      <Card className="col-span-2 md:col-span-4">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm text-muted-foreground">
          <span>{featured} missioni in evidenza</span>
          <span>{missions.filter((mission) => mission.visibility === "secret").length} missioni segrete</span>
          <span>{missions.filter((mission) => mission.type === "seasonal").length} campagne stagionali</span>
          <span>{missions.filter((mission) => mission.type === "progressive" || mission.type === "streak").length} missioni avanzate</span>
        </CardContent>
      </Card>
    </div>
  );
}
