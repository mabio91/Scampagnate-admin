import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RowActionButton, RowActionCell } from "@/components/RowActions";
import { Table, TableBody, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

describe("RowActions", () => {
  it("keeps row action clicks from triggering the parent row", () => {
    const onRowClick = vi.fn();

    render(
      <Table>
        <TableBody>
          <TableRow onClick={onRowClick}>
            <RowActionCell>
              <RowActionButton aria-label="Azioni riga" />
            </RowActionCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    const button = screen.getByRole("button", { name: "Azioni riga" });

    fireEvent.click(button);

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

  it("allows dropdown triggers in action cells to open their menu", () => {
    render(
      <Table>
        <TableBody>
          <TableRow>
            <RowActionCell>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <RowActionButton aria-label="Azioni riga" />
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem>Modifica</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </RowActionCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    fireEvent.keyDown(screen.getByRole("button", { name: "Azioni riga" }), { key: "Enter" });

    expect(screen.getByText("Modifica")).toBeInTheDocument();
  });
});
