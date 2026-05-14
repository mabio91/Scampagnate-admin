import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { TrekkingDifficultyGuide } from "@/components/TrekkingDifficultyGuide";

interface ContentPage {
  id: string;
  title: string;
  slug: string;
  content_html: string;
  is_published: boolean;
}

export default function ContentPageView() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const { data: page, isLoading, error } = useQuery({
    queryKey: ["content-page", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_pages")
        .select("*")
        .eq("slug", slug!)
        .eq("is_published", true)
        .single();
      if (error) throw error;
      return data as ContentPage;
    },
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto py-8 px-4 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="max-w-3xl mx-auto py-8 px-4 text-center space-y-4">
        <h1 className="text-2xl font-bold text-foreground">Pagina non trovata</h1>
        <p className="text-muted-foreground">La pagina richiesta non esiste o non è pubblicata.</p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Indietro
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <Button variant="ghost" size="sm" className="mb-6" onClick={() => navigate(-1)}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Indietro
      </Button>
      <h1 className="text-3xl font-bold text-foreground mb-6">{page.title}</h1>
      <div
        className="prose dark:prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: page.content_html }}
      />
      {slug === "guida-difficolta-trekking" && <TrekkingDifficultyGuide />}
    </div>
  );
}
