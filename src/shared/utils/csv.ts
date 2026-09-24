function stripBom(input: string): string {
  return input.charCodeAt(0) === 0xfeff ? input.slice(1) : input
}

export function parseCsv(input: string): string[][] {
  const text = stripBom(input)
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0

  const endField = () => {
    row.push(field)
    field = ''
  }
  const endRow = () => {
    endField()
    rows.push(row)
    row = []
  }

  while (i < text.length) {
    const char = text[i]

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i += 1
        continue
      }
      field += char
      i += 1
      continue
    }

    if (char === '"' && field === '') {
      inQuotes = true
      i += 1
      continue
    }
    if (char === ',') {
      endField()
      i += 1
      continue
    }
    if (char === '\r') {
      i += text[i + 1] === '\n' ? 2 : 1
      endRow()
      continue
    }
    if (char === '\n') {
      i += 1
      endRow()
      continue
    }

    field += char
    i += 1
  }

  if (field !== '' || row.length > 0) {
    endRow()
  }

  return rows
}

export interface CsvTable {
  header: string[]
  records: Record<string, string>[]
}

export function parseCsvTable(input: string): CsvTable {
  const [firstRow, ...body] = parseCsv(input)
  if (!firstRow) return { header: [], records: [] }

  const header = firstRow.map((cell) => cell.trim())
  const records = body
    .filter((row) => !(row.length === 1 && row[0]?.trim() === ''))
    .map((row) => {
      const record: Record<string, string> = {}
      header.forEach((column, index) => {
        record[column] = (row[index] ?? '').trim()
      })
      return record
    })

  return { header, records }
}

export function toCsvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  const text = value instanceof Date ? value.toISOString() : String(value)
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

export function toCsv(header: string[], rows: unknown[][]): string {
  const lines = [header.map(toCsvCell).join(',')]
  for (const row of rows) {
    lines.push(row.map(toCsvCell).join(','))
  }
  return `${lines.join('\n')}\n`
}
