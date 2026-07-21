/**
 * Minimal multi-sheet Excel writer — no dependency.
 *
 * Emits the SpreadsheetML 2003 XML format (a single XML file Excel opens as a
 * real, multi-sheet workbook with styling and merged cells). Saved as `.xls`.
 * Chosen over a heavy library because it needs zero install and round-trips
 * cleanly in Excel / LibreOffice / Google Sheets.
 */

export type CellValue = string | number | null | undefined
export interface Cell { v: CellValue; style?: string; colspan?: number }
export type Row = (Cell | CellValue)[]
export interface Sheet { name: string; rows: Row[]; colWidths?: number[] }

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
   .replace(/"/g, '&quot;').replace(/\r?\n/g, '&#10;')

// Excel sheet names: ≤31 chars, none of : \ / ? * [ ]
const sheetName = (n: string, used: Set<string>) => {
  let s = (n || 'Feuille').replace(/[:\\/?*[\]]/g, ' ').slice(0, 31).trim() || 'Feuille'
  let base = s, i = 2
  while (used.has(s.toLowerCase())) { s = `${base.slice(0, 28)} ${i++}` }
  used.add(s.toLowerCase())
  return s
}

const cell = (c: Cell | CellValue): Cell =>
  (c !== null && typeof c === 'object') ? c as Cell : { v: c as CellValue }

function cellXml(c: Cell): string {
  const style = c.style ? ` ss:StyleID="${c.style}"` : ''
  const merge = c.colspan && c.colspan > 1 ? ` ss:MergeAcross="${c.colspan - 1}"` : ''
  if (c.v === null || c.v === undefined || c.v === '') return `<Cell${style}${merge}/>`
  const isNum = typeof c.v === 'number' && Number.isFinite(c.v)
  const type = isNum ? 'Number' : 'String'
  const val = isNum ? String(c.v) : esc(String(c.v))
  return `<Cell${style}${merge}><Data ss:Type="${type}">${val}</Data></Cell>`
}

/** Built-in style ids usable via Cell.style: title | head | sub | good | bad | bold. */
const STYLES = `
 <Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Center"/><Font ss:FontName="Calibri" ss:Size="11"/></Style>
 <Style ss:ID="title"><Font ss:Bold="1" ss:Size="15" ss:Color="#0F172A"/></Style>
 <Style ss:ID="head"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#4F46E5" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style>
 <Style ss:ID="sub"><Font ss:Bold="1" ss:Color="#334155"/><Interior ss:Color="#E2E8F0" ss:Pattern="Solid"/></Style>
 <Style ss:ID="bold"><Font ss:Bold="1"/></Style>
 <Style ss:ID="good"><Font ss:Bold="1" ss:Color="#166534"/><Interior ss:Color="#DCFCE7" ss:Pattern="Solid"/></Style>
 <Style ss:ID="bad"><Font ss:Color="#991B1B"/><Interior ss:Color="#FEE2E2" ss:Pattern="Solid"/></Style>
 <Style ss:ID="num2"><NumberFormat ss:Format="0.00"/></Style>`

export function buildWorkbook(sheets: Sheet[]): string {
  const used = new Set<string>()
  const wsXml = sheets.map((sh) => {
    const cols = (sh.colWidths ?? []).map((w, i) => `<Column ss:Index="${i + 1}" ss:Width="${w}"/>`).join('')
    const rows = sh.rows.map((r) => `<Row>${r.map((c) => cellXml(cell(c))).join('')}</Row>`).join('')
    return `<Worksheet ss:Name="${esc(sheetName(sh.name, used))}"><Table>${cols}${rows}</Table></Worksheet>`
  }).join('')
  return `<?xml version="1.0"?>\n<?mso-application progid="Excel.Sheet"?>\n`
    + `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"`
    + ` xmlns:o="urn:schemas-microsoft-com:office:office"`
    + ` xmlns:x="urn:schemas-microsoft-com:office:excel"`
    + ` xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">`
    + `<Styles>${STYLES}</Styles>${wsXml}</Workbook>`
}

export function downloadWorkbook(filename: string, sheets: Sheet[]) {
  const xml = buildWorkbook(sheets)
  const blob = new Blob([xml], { type: 'application/vnd.ms-excel' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.xls') ? filename : `${filename}.xls`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
