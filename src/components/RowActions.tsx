import * as React from "react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { TableCell } from "@/components/ui/table";
import { cn } from "@/lib/utils";

function stopRowActionPropagation(event: React.SyntheticEvent) {
  event.stopPropagation();
}

type RowActionCellProps = React.ComponentProps<typeof TableCell>;

export function RowActionCell({ className, ...props }: RowActionCellProps) {
  return (
    <TableCell
      className={cn("w-14 min-w-14 p-1 text-right sm:w-10 sm:min-w-10 sm:p-2", className)}
      onClick={stopRowActionPropagation}
      {...props}
    />
  );
}

export const RowActionButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, type = "button", ...props }, ref) => (
    <Button
      ref={ref}
      type={type}
      variant="ghost"
      size="icon"
      className={cn("h-11 w-11 touch-manipulation sm:h-8 sm:w-8", className)}
      {...props}
    />
  ),
);
RowActionButton.displayName = "RowActionButton";
