import { Users, Building2, Calendar, AlertTriangle, TrendingUp, Activity } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const userGrowthData = [
  { month: "Sep", users: 1820 },
  { month: "Oct", users: 2010 },
  { month: "Nov", users: 2180 },
  { month: "Dec", users: 2340 },
  { month: "Jan", users: 2580 },
  { month: "Feb", users: 2720 },
  { month: "Mar", users: 2847 },
];

const eventsByMonth = [
  { month: "Sep", events: 28, registrations: 420 },
  { month: "Oct", events: 35, registrations: 510 },
  { month: "Nov", events: 42, registrations: 680 },
  { month: "Dec", events: 30, registrations: 490 },
  { month: "Jan", events: 48, registrations: 720 },
  { month: "Feb", events: 52, registrations: 810 },
  { month: "Mar", events: 55, registrations: 860 },
];

const categoryDistribution = [
  { name: "Hiking", value: 35 },
  { name: "Cycling", value: 25 },
  { name: "Running", value: 20 },
  { name: "Skiing", value: 12 },
  { name: "Other", value: 8 },
];

const issuesTrend = [
  { week: "W1", opened: 5, resolved: 4 },
  { week: "W2", opened: 3, resolved: 5 },
  { week: "W3", opened: 7, resolved: 6 },
  { week: "W4", opened: 2, resolved: 4 },
  { week: "W5", opened: 4, resolved: 3 },
  { week: "W6", opened: 1, resolved: 3 },
];

const PIE_COLORS = [
  "hsl(150, 40%, 20%)",   // primary
  "hsl(30, 50%, 55%)",    // secondary
  "hsl(25, 70%, 50%)",    // accent
  "hsl(140, 50%, 40%)",   // success
  "hsl(40, 15%, 60%)",    // muted
];

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

const chartTooltipStyle = {
  contentStyle: {
    backgroundColor: "hsl(40, 25%, 99%)",
    border: "1px solid hsl(40, 15%, 87%)",
    borderRadius: "0.625rem",
    fontSize: "0.8rem",
  },
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

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-accent" />
              User Growth
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={userGrowthData}>
                <defs>
                  <linearGradient id="userGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(150, 40%, 20%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(150, 40%, 20%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(40, 15%, 87%)" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(150, 10%, 45%)" }} />
                <YAxis tick={{ fontSize: 12, fill: "hsl(150, 10%, 45%)" }} />
                <Tooltip {...chartTooltipStyle} />
                <Area type="monotone" dataKey="users" stroke="hsl(150, 40%, 20%)" fill="url(#userGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5 text-accent" />
              Events & Registrations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={eventsByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(40, 15%, 87%)" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(150, 10%, 45%)" }} />
                <YAxis tick={{ fontSize: 12, fill: "hsl(150, 10%, 45%)" }} />
                <Tooltip {...chartTooltipStyle} />
                <Legend />
                <Bar dataKey="events" fill="hsl(150, 40%, 20%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="registrations" fill="hsl(30, 50%, 55%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Category Distribution</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={categoryDistribution} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {categoryDistribution.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip {...chartTooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Issues Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={issuesTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(40, 15%, 87%)" />
                <XAxis dataKey="week" tick={{ fontSize: 12, fill: "hsl(150, 10%, 45%)" }} />
                <YAxis tick={{ fontSize: 12, fill: "hsl(150, 10%, 45%)" }} />
                <Tooltip {...chartTooltipStyle} />
                <Legend />
                <Line type="monotone" dataKey="opened" stroke="hsl(0, 65%, 50%)" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="resolved" stroke="hsl(140, 50%, 40%)" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="h-5 w-5 text-accent" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentActivity.map((item, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b last:border-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-[10px] ${typeColors[item.type]}`}>{item.type}</Badge>
                    <div>
                      <p className="text-xs font-medium">{item.action}</p>
                      <p className="text-[10px] text-muted-foreground">{item.user}</p>
                    </div>
                  </div>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">{item.time}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}