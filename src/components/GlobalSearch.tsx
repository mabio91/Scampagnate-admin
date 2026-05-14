import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Users, Calendar, AlertTriangle, ShoppingBag, IdCard, Building2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { formatMembershipId } from "@/lib/membership";

interface SearchResult {
  id: string;
  label: string;
  subtitle?: string;
  category: "user" | "organizer" | "event" | "member" | "issue" | "merch";
  route: string;
}

const categoryConfig = {
  user: { icon: Users, color: "bg-blue-500/10 text-blue-600 border-blue-500/30" },
  organizer: { icon: Building2, color: "bg-purple-500/10 text-purple-600 border-purple-500/30" },
  event: { icon: Calendar, color: "bg-green-500/10 text-green-600 border-green-500/30" },
  member: { icon: IdCard, color: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  issue: { icon: AlertTriangle, color: "bg-destructive/10 text-destructive border-destructive/30" },
  merch: { icon: ShoppingBag, color: "bg-pink-500/10 text-pink-600 border-pink-500/30" },
};

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const { t } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut: Ctrl+K / Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const debouncedQuery = useDebounce(query, 250);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["global-search", debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery || debouncedQuery.length < 2) return [];
      const q = debouncedQuery.toLowerCase();
      const allResults: SearchResult[] = [];

      // Search users/profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email, membership_status, membership_id")
        .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`)
        .limit(10);

      // Get roles for found profiles
      const profileIds = (profiles || []).map(p => p.id);
      const { data: roles } = profileIds.length > 0
        ? await supabase.from("user_roles").select("user_id, role").in("user_id", profileIds)
        : { data: [] };

      const roleMap = new Map<string, string[]>();
      (roles || []).forEach(r => {
        if (!roleMap.has(r.user_id)) roleMap.set(r.user_id, []);
        roleMap.get(r.user_id)!.push(r.role);
      });

      (profiles || []).forEach(p => {
        const userRoles = roleMap.get(p.id) || [];
        const isOrgOrAdmin = userRoles.includes("organizer") || userRoles.includes("admin");
        const name = `${p.first_name} ${p.last_name}`.trim();

        // Add as user
        allResults.push({
          id: `user-${p.id}`,
          label: name,
          subtitle: p.email || undefined,
          category: "user",
          route: `/users/${p.id}`,
        });

        // Also add as organizer if applicable
        if (isOrgOrAdmin) {
          allResults.push({
            id: `org-${p.id}`,
            label: name,
            subtitle: userRoles.join(", "),
            category: "organizer",
            route: `/organizers/${p.id}`,
          });
        }

        // Add as member if has membership
        if (p.membership_status === "Active" && p.membership_id) {
          allResults.push({
            id: `member-${p.id}`,
            label: name,
            subtitle: `#${formatMembershipId(p.membership_id)}`,
            category: "member",
            route: `/members`,
          });
        }
      });

      // Search events
      const { data: events } = await supabase
        .from("events")
        .select("id, title, date, status, location")
        .or(`title.ilike.%${q}%,location.ilike.%${q}%`)
        .order("date", { ascending: false })
        .limit(8);

      (events || []).forEach(e => {
        allResults.push({
          id: `event-${e.id}`,
          label: e.title,
          subtitle: `${new Date(e.date).toLocaleDateString()} · ${e.status}`,
          category: "event",
          route: `/events`,
        });
      });

      // Search issues
      const { data: issues } = await supabase
        .from("issues")
        .select("id, title, status, priority")
        .or(`title.ilike.%${q}%,description.ilike.%${q}%`)
        .limit(5);

      (issues || []).forEach(i => {
        allResults.push({
          id: `issue-${i.id}`,
          label: i.title,
          subtitle: `${i.priority} · ${i.status}`,
          category: "issue",
          route: `/issues`,
        });
      });

      // Search merch products
      const { data: merch } = await supabase
        .from("merch_products")
        .select("id, name, price, is_active")
        .or(`name.ilike.%${q}%,description.ilike.%${q}%`)
        .limit(5);

      (merch || []).forEach(m => {
        allResults.push({
          id: `merch-${m.id}`,
          label: m.name,
          subtitle: `€${m.price} · ${m.is_active ? "Active" : "Inactive"}`,
          category: "merch",
          route: `/merch`,
        });
      });

      return allResults;
    },
    enabled: debouncedQuery.length >= 2,
    staleTime: 30000,
  });

  const handleSelect = useCallback((result: SearchResult) => {
    navigate(result.route);
    setOpen(false);
    setQuery("");
  }, [navigate]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[selectedIndex]) handleSelect(results[selectedIndex]);
    }
  };

  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  const categoryLabels: Record<string, string> = {
    user: t("sidebar.users"),
    organizer: t("sidebar.organizers"),
    event: t("sidebar.events"),
    member: t("sidebar.members"),
    issue: t("sidebar.issues"),
    merch: t("sidebar.merch"),
  };

  // Group results by category
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    if (!acc[r.category]) acc[r.category] = [];
    acc[r.category].push(r);
    return acc;
  }, {});

  let flatIndex = -1;

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => query.length >= 2 && setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={`${t("globalSearch.placeholder")}  ⌘K`}
          className="pl-9 pr-8 h-9 bg-muted/50 border-muted-foreground/20 focus:bg-background"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setOpen(false); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && query.length >= 2 && (
        <div className="absolute top-full mt-1 left-0 right-0 z-50 rounded-lg border bg-popover shadow-lg max-h-[420px] overflow-y-auto">
          {isFetching && results.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              {t("globalSearch.searching")}
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              {t("globalSearch.noResults")}
            </div>
          ) : (
            Object.entries(grouped).map(([cat, items]) => (
              <div key={cat}>
                <div className="px-3 py-1.5 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold bg-muted/30 sticky top-0">
                  {categoryLabels[cat] || cat}
                </div>
                {items.map((result) => {
                  flatIndex++;
                  const idx = flatIndex;
                  const config = categoryConfig[result.category];
                  const Icon = config.icon;
                  return (
                    <button
                      key={result.id}
                      onClick={() => handleSelect(result)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors ${
                        idx === selectedIndex ? "bg-accent" : "hover:bg-accent/50"
                      }`}
                    >
                      <div className={`p-1.5 rounded-md ${config.color}`}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{result.label}</p>
                        {result.subtitle && (
                          <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
                        )}
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {categoryLabels[result.category]}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
