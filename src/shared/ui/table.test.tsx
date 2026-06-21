import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from "./table";

describe("Table", () => {
  it("renders table inside a scrolling wrapper", () => {
    render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>data</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("renders column headers from TableHead elements", () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
      </Table>,
    );

    const headers = screen.getAllByRole("columnheader");
    expect(headers).toHaveLength(2);
    expect(headers[0]).toHaveTextContent("Name");
    expect(headers[1]).toHaveTextContent("Status");
  });

  it("renders body cells from TableCell elements", () => {
    render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>John</TableCell>
            <TableCell>Active</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    const cells = screen.getAllByRole("cell");
    expect(cells).toHaveLength(2);
    expect(cells[0]).toHaveTextContent("John");
    expect(cells[1]).toHaveTextContent("Active");
  });

  it("renders multiple body rows", () => {
    render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>Row 1</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Row 2</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    const cells = screen.getAllByRole("cell");
    expect(cells).toHaveLength(2);
    expect(cells[0]).toHaveTextContent("Row 1");
    expect(cells[1]).toHaveTextContent("Row 2");
  });

  it("renders footer cells alongside body cells", () => {
    render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>Item</TableCell>
          </TableRow>
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell>Total</TableCell>
          </TableRow>
        </TableFooter>
      </Table>,
    );

    const cells = screen.getAllByRole("cell");
    expect(cells).toHaveLength(2);
    expect(cells[0]).toHaveTextContent("Item");
    expect(cells[1]).toHaveTextContent("Total");
  });

  it("renders caption text", () => {
    render(
      <Table>
        <TableCaption>Material inventory</TableCaption>
        <TableBody>
          <TableRow>
            <TableCell>Data</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(screen.getByText("Material inventory")).toBeInTheDocument();
  });

  it("renders a full table with all sections", () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead>Price</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Chair</TableCell>
            <TableCell>$100</TableCell>
          </TableRow>
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell>Total</TableCell>
            <TableCell>$100</TableCell>
          </TableRow>
        </TableFooter>
        <TableCaption>Current inventory</TableCaption>
      </Table>,
    );

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader")).toHaveLength(2);
    expect(screen.getAllByRole("cell")).toHaveLength(4);
    expect(screen.getByText("Current inventory")).toBeInTheDocument();
  });
});
