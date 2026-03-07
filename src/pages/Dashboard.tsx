import { Users, Building2, Calendar, AlertTriangle, TrendingUp, Activity } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const recentActivity = [
  { action: "New user registered", user: "Marco Rossi", time: "2 min ago", type: "user" },
  { action: "Event created", user: "Luca Bianchi", time: "15 min ago", type: "event" },
  { action: "Issue reported", user: "Anna Verdi", time: "1h ago", type: "issue" },
  { action: "Organizer approved", user: "Festival Milano", time: "2h ago", type: "organizer" },
  { action: "Category added", user: "System", time: "3h ago", type: "category" },
];

const typeColors: Record<string, string> = {
  user: "bg-primary/10 text-primary",
  event: "bg-secondary/20 text-secondary",
  issue: "bg-destructive/10 text-destructive",
  organizer: "bg-accent/20 text-accent",
  category: "bg-muted text-muted-foreground",
};

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Welcome back, Super Admin</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Users" value="2,847" icon={Users} change="+12% this month" changeType="positive" />
        <StatCard title="Organizers" value="184" icon={Building2} change="+5 pending" changeType="neutral" />
        <StatCard title="Active Events" value="342" icon={Calendar} change="+28 this week" changeType="positive" />
        <StatCard title="Open Issues" value="7" icon={AlertTriangle} change="-3 resolved" changeType="positive" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="h-5 w-5 text-accent" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((item, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className={typeColors[item.type]}>{item.type}</Badge>
                    <div>
                      <p className="text-sm font-medium">{item.action}</p>
                      <p className="text-xs text-muted-foreground">{item.user}</p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{item.time}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-accent" />
              Platform Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { label: "User Growth", value: 78, color: "bg-primary" },
                { label: "Event Completion", value: 92, color: "bg-secondary" },
                { label: "Organizer Satisfaction", value: 85, color: "bg-accent" },
                { label: "Issue Resolution", value: 96, color: "bg-success" },
              ].map((stat) => (
                <div key={stat.label} className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{stat.label}</span>
                    <span className="text-muted-foreground">{stat.value}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${stat.color}`} style={{ width: `${stat.value}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
