import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RowActionButton, RowActionCell } from "@/components/RowActions";
import { Table, TableBody, TableRow } from "@/components/ui/table";

describe("RowActions", () => {
  it("keeps row action taps from triggering the parent row", () => {
    const onRowClick = vi.fn();
    const onRowPointerDown = vi.fn();

    render(
      <Table>
        <TableBody>
          <TableRow onClick={onRowClick} onPointerDown={onRowPointerDown}>
            <RowActionCell>
              <RowActionButton aria-label="Azioni riga" />
            </RowActionCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    const button = screen.getByRole("button", { name: "Azioni riga" });

    fireEvent.pointerDown(button);
    fireEvent.click(button);

    expect(onRowPointerDown).not.toHaveBeenCalled();
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("uses a larger touch target on mobile and the compact size from the sm breakpoint", () => {
    render(<RowActionButton aria-label="Azioni riga" />);

    expect(screen.getByRole("button", { name: "Azioni riga" })).toHaveClass(
      "h-11",
      "w-11",
      "touch-manipulation",
      "sm:h-8",
      "sm:w-8",
    );
  });
});
