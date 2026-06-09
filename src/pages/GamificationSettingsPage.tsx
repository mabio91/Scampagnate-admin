import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import RefreshButton from "@/components/RefreshButton";
import PointsConfigTab from "@/components/gamification/PointsConfigTab";
import LevelsTab from "@/components/gamification/LevelsTab";
import BadgesTab from "@/components/gamification/BadgesTab";

export default function GamificationSettingsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Impostazioni Gamification</h1>
          <p className="text-muted-foreground">Configura punti, livelli, badge e ricompense</p>
        </div>
        <RefreshButton queryKeys={[["points-config"], ["community-levels-admin"], ["badges-admin"], ["event-categories"], ["event-fit-score-categories"]]} />
      </div>

      <Tabs defaultValue="points">
        <TabsList>
          <TabsTrigger value="points">Punti</TabsTrigger>
          <TabsTrigger value="levels">Livelli</TabsTrigger>
          <TabsTrigger value="badges">Badge</TabsTrigger>
        </TabsList>

        <TabsContent value="points" className="mt-4">
          <PointsConfigTab />
        </TabsContent>

        <TabsContent value="levels" className="mt-4">
          <LevelsTab />
        </TabsContent>

        <TabsContent value="badges" className="mt-4">
          <BadgesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
