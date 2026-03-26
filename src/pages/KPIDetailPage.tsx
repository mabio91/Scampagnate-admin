import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/LanguageContext";
import { KPIDetailContent, KPI_META, type KPIType } from "@/components/dashboard/KPIDetailContent";
import type { DashboardFilterValues } from "@/components/dashboard/DashboardFilters";

export default function KPIDetailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { language } = useLanguage();

  const kpiType = (searchParams.get("type") || null) as KPIType;
  const meta = kpiType ? KPI_META[kpiType] : null;

  const filters: DashboardFilterValues = {
    dateFrom: searchParams.get("dateFrom") ? new Date(searchParams.get("dateFrom")!) : undefined,
    dateTo: searchParams.get("dateTo") ? new Date(searchParams.get("dateTo")!) : undefined,
    categoryId: searchParams.get("categoryId") || undefined,
    organizerId: searchParams.get("organizerId") || undefined,
    eventStatus: searchParams.get("eventStatus") || undefined,
    membershipYear: searchParams.get("membershipYear") || undefined,
  };

  if (!kpiType || !meta) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={() => navigate("/")} className="gap-2 mb-4">
          <ArrowLeft className="h-4 w-4" />
          Torna alla Dashboard
        </Button>
        <p className="text-muted-foreground">KPI non trovato.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold">{language === "it" ? meta.titleIt : meta.title}</h1>
        <p className="text-sm text-muted-foreground mt-1">{language === "it" ? meta.descriptionIt : meta.description}</p>
      </div>

      <KPIDetailContent type={kpiType} filters={filters} />
    </div>
  );
}
