import * as XLSX from "xlsx";
import type { Cell } from "./salary-sheet";

export interface WorkbookSheet { name: string; values: Cell[][]; formulas: (string | undefined)[][] }

/** Read every sheet's cached values and formulas from an .xlsx/.xls/.csv file. */
export function readWorkbook(data: ArrayBuffer): WorkbookSheet[] {
  const book = XLSX.read(data, { type: "array", cellFormula: true, cellDates: true });
  return book.SheetNames.map(name => {
    const sheet = book.Sheets[name];
    const ref = sheet["!ref"];
    if (!ref) return { name, values: [], formulas: [] };
    const range = XLSX.utils.decode_range(ref);
    const values: Cell[][] = []; const formulas: (string | undefined)[][] = [];
    for (let r = 0; r <= Math.min(range.e.r, 2000); r++) {
      const v: Cell[] = []; const f: (string | undefined)[] = [];
      for (let c = 0; c <= Math.min(range.e.c, 80); c++) {
        const cell = sheet[XLSX.utils.encode_cell({ r, c })];
        v.push(cell ? (cell.v as Cell) : null); f.push(cell?.f ? `=${cell.f}` : undefined);
      }
      values.push(v); formulas.push(f);
    }
    return { name, values, formulas };
  });
}
