import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clock, CheckCircle2, MessageSquare } from "lucide-react";

const mockIssues = [
  { id: 1, title: "Event organizer not responding to participants", reporter: "Marco Rossi", event: "Trekking Monte Bianco", priority: "high", status: "open", date: "2025-03-05" },
  { id: 2, title: "Incorrect event location listed", reporter: "Anna Verdi", event: "Ciclismo Chianti", priority: "medium", status: "in_progress", date: "2025-03-04" },
  { id: 3, title: "Payment not processed for registration", reporter: "Luca Bianchi", event: "Campeggio Lago Garda", priority: "high", status: "open", date: "2025-03-03" },
  { id: 4, title: "Spam event listing reported", reporter: "Sofia Russo", event: "Fake Event", priority: "low", status: "resolved", date: "2025-03-01" },
  { id: 5, title: "Inappropriate content in event description", reporter: "Giuseppe Conti", event: "Orienteering Foresta Nera", priority: "high", status: "open", date: "2025-03-06" },
];

const priorityStyles: Record<string, string> = {
  high: "bg-destructive/10 text-destructive border-destructive/20",
  medium: "bg-warning/10 text-warning border-warning/20",
  low: "bg-muted text-muted-foreground",
};

const statusIcon: Record<string, typeof AlertTriangle> = {
  open: AlertTriangle,
  in_progress: Clock,
  resolved: CheckCircle2,
};

export default function IssuesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Issues</h1>
        <p className="text-muted-foreground mt-1">Intervene and resolve platform issues</p>
      </div>

      <div className="space-y-3">
        {mockIssues.map((issue) => {
          const StatusIcon = statusIcon[issue.status] || AlertTriangle;
          return (
            <Card key={issue.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={`p-2 rounded-lg mt-0.5 ${issue.status === "open" ? "bg-destructive/10" : issue.status === "in_progress" ? "bg-warning/10" : "bg-success/10"}`}>
                      <StatusIcon className={`h-4 w-4 ${issue.status === "open" ? "text-destructive" : issue.status === "in_progress" ? "text-warning" : "text-success"}`} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold font-sans">{issue.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Reported by <span className="font-medium text-foreground">{issue.reporter}</span> • Event: {issue.event}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className={priorityStyles[issue.priority]}>{issue.priority}</Badge>
                        <span className="text-xs text-muted-foreground">{issue.date}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <MessageSquare className="h-3.5 w-3.5" /> Respond
                    </Button>
                    {issue.status !== "resolved" && (
                      <Button size="sm" className="gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Resolve
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
