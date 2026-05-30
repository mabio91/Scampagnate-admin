import { useState } from "react";
import { CalendarDays, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { cn } from "@/lib/utils";

export interface DashboardFilterValues {
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  categoryId: string | undefined;
  organizerId: string | undefined;
  eventStatus: string | undefined;
  membershipYear: string | undefined;
}

interface DashboardFiltersProps {
  filters: DashboardFilterValues;
  onChange: (filters: DashboardFilterValues) => void;
}

export function DashboardFilters({ filters, onChange }: DashboardFiltersProps) {
  const { t } = useLanguage();
  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);

  const { data: categories = [] } = useQuery({
    queryKey: ["filter-categories"],
    queryFn: async () => {
      const { data } = await supabase.from("event_categories").select("id, name").order("name");
      return data || [];
    },
  });

  const { data: organizers = [] } = useQuery({
    queryKey: ["filter-organizers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["organizer", "admin"]);
      if (!data || data.length === 0) return [];
      const ids = data.map(r => r.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", ids);
      return profiles || [];
    },
  });

  const currentYear = new Date().getFullYear();
  const membershipYears = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const hasFilters = filters.dateFrom || filters.dateTo || filters.categoryId || filters.organizerId || filters.eventStatus || filters.membershipYear;

  const clearFilters = () => {
    onChange({ dateFrom: undefined, dateTo: undefined, categoryId: undefined, organizerId: undefined, eventStatus: undefined, membershipYear: undefined });
  };

  const activeCount = [filters.dateFrom, filters.dateTo, filters.categoryId, filters.organizerId, filters.eventStatus, filters.membershipYear].filter(Boolean).length;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5 text-muted-foreground mr-1">
        <Filter className="h-3.5 w-3.5" />
        <span className="text-xs font-semibold uppercase tracking-wider">Filtri</span>
        {activeCount > 0 && (
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-bold">{activeCount}</Badge>
        )}
      </div>

      {/* Date From */}
      <Popover open={fromOpen} onOpenChange={setFromOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className={cn("h-8 text-xs gap-1.5", filters.dateFrom && "border-primary text-primary")}>
            <CalendarDays className="h-3.5 w-3.5" />
            {filters.dateFrom ? format(filters.dateFrom, "dd/MM/yyyy") : "Da"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={filters.dateFrom} onSelect={(d) => { onChange({ ...filters, dateFrom: d }); setFromOpen(false); }} className="p-3 pointer-events-auto" />
        </PopoverContent>
      </Popover>

      {/* Date To */}
      <Popover open={toOpen} onOpenChange={setToOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className={cn("h-8 text-xs gap-1.5", filters.dateTo && "border-primary text-primary")}>
            <CalendarDays className="h-3.5 w-3.5" />
            {filters.dateTo ? format(filters.dateTo, "dd/MM/yyyy") : "A"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={filters.dateTo} onSelect={(d) => { onChange({ ...filters, dateTo: d }); setToOpen(false); }} className="p-3 pointer-events-auto" />
        </PopoverContent>
      </Popover>

      {/* Category */}
      <Select value={filters.categoryId || "all"} onValueChange={(v) => onChange({ ...filters, categoryId: v === "all" ? undefined : v })}>
        <SelectTrigger className="h-8 w-auto min-w-[130px] text-xs">
          <SelectValue placeholder="Categoria" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tutte le categorie</SelectItem>
          {categories.map((c) => (
            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Organizer */}
      <Select value={filters.organizerId || "all"} onValueChange={(v) => onChange({ ...filters, organizerId: v === "all" ? undefined : v })}>
        <SelectTrigger className="h-8 w-auto min-w-[140px] text-xs">
          <SelectValue placeholder="Organizzatore" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tutti gli organizzatori</SelectItem>
          {organizers.map((o) => (
            <SelectItem key={o.id} value={o.id}>{o.first_name} {o.last_name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Event Status */}
      <Select value={filters.eventStatus || "all"} onValueChange={(v) => onChange({ ...filters, eventStatus: v === "all" ? undefined : v })}>
        <SelectTrigger className="h-8 w-auto min-w-[120px] text-xs">
          <SelectValue placeholder="Stato evento" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tutti gli stati</SelectItem>
          <SelectItem value="published">Pubblicato</SelectItem>
          <SelectItem value="draft">Bozza</SelectItem>
          <SelectItem value="available">Disponibile</SelectItem>
          <SelectItem value="full">Completo</SelectItem>
          <SelectItem value="closed">Chiuso</SelectItem>
          <SelectItem value="cancelled">Annullato</SelectItem>
          <SelectItem value="past">Passato</SelectItem>
          <SelectItem value="completed">Concluso</SelectItem>
        </SelectContent>
      </Select>

      {/* Membership Year */}
      <Select value={filters.membershipYear || "all"} onValueChange={(v) => onChange({ ...filters, membershipYear: v === "all" ? undefined : v })}>
        <SelectTrigger className="h-8 w-auto min-w-[110px] text-xs">
          <SelectValue placeholder="Anno tessera" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tutti gli anni</SelectItem>
          {membershipYears.map((y) => (
            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button variant="ghost" size="sm" className="h-8 text-xs text-destructive hover:text-destructive" onClick={clearFilters}>
          <X className="h-3.5 w-3.5 mr-1" />
          Reset
        </Button>
      )}
    </div>
  );
}
