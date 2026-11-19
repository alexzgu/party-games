// Reading lists people paste, often copied from the Claude app: plain lines, numbered or
// bulleted lists, or markdown tables. Each game parses the lines this returns.

const TABLE_RULE = /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?$/;
const NUMBER_CELL = /^\d+[.)]?$/;

/** Lines worth reading: no blanks, code fences, table rules or the header row above a rule. */
export function pastedLines(text: string): string[] {
  const all = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('```'));
  return all.filter((l, i) => !TABLE_RULE.test(l) && !(l.includes('|') && TABLE_RULE.test(all[i + 1] ?? '')));
}

/** Table row cells without the row-number column: `| 3 | Cold | Hot |` → ['Cold', 'Hot']. */
export function tableCells(line: string): string[] {
  return line.split('|').map((c) => c.trim()).filter((c) => c && !NUMBER_CELL.test(c));
}

/** A table row as `A | B`, minus its row-number column; other lines unchanged. */
export function dropNumberCells(line: string): string {
  return line.startsWith('|') ? tableCells(line).join(' | ') : line;
}

/** A table row → its first real cell; other lines unchanged. */
export function firstCell(line: string): string {
  return line.includes('|') ? (tableCells(line)[0] ?? '') : line;
}
