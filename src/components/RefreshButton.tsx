import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface RefreshButtonProps {
  queryKeys: string[][];
  className?: string;
}

export default function RefreshButton({ queryKeys, className }: RefreshButtonProps) {
  const queryClient = useQueryClient();
  const [spinning, setSpinning] = useState(false);

  const handleRefresh = async () => {
    setSpinning(true);
    await Promise.all(
      queryKeys.map((key) => queryClient.invalidateQueries({ queryKey: key }))
    );
    setTimeout(() => setSpinning(false), 600);
  };

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={handleRefresh}
      className={cn("shrink-0", className)}
      title="Refresh"
    >
      <RefreshCw className={cn("h-4 w-4 transition-transform", spinning && "animate-spin")} />
    </Button>
  );
}
