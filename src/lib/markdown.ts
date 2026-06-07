/**
 * Converts a Markdown string into EditorJS-compatible JSON blocks.
 *
 * Supported Markdown syntax:
 *   # H1 – ###### H6  → header block
 *   paragraph text     → paragraph block
 *   - / * / + item     → unordered list
 *   1. item            → ordered list
 *   > quote            → quote block
 *   ```code```         → codeBox block
 *   --- / *** / ___    → delimiter block
 *   ![alt](url)        → image block
 *   - [ ] / - [x]      → checklist block
 *   | col1 | col2 |    → table block (GFM)
 *   $$latex$$          → math block
 *
 * Inline formatting (converted to HTML within block text):
 *   **bold**           → <b>bold</b>
 *   *italic*           → <i>italic</i>
 *   `code`             → <code>code</code>
 *   ~~strikethrough~~  → <s>strikethrough</s>
 *   [text](url)        → <a href="url">text</a>
 *   $E=mc^2$           → <span class="math-inline">E=mc^2</span>
 */

// ── Types ──────────────────────────────────────────────────────────

interface EditorJSBlock {
  type: string
  data: Record<string, unknown>
}

interface EditorJSOutput {
  time: number
  blocks: EditorJSBlock[]
  version: string
  [key: string]: unknown
}

type BlockAccumulator =
  | { type: 'paragraph'; lines: string[] }
  | { type: 'unorderedList'; items: string[] }
  | { type: 'orderedList'; items: string[] }
  | { type: 'blockquote'; lines: string[] }
  | { type: 'checklist'; items: { text: string; checked: boolean }[] }
  | { type: 'codeBlock'; lines: string[]; language: string }
  | { type: 'mathBlock'; lines: string[] }
  | { type: 'table'; rows: string[][] }

// ── Inline formatters ──────────────────────────────────────────────

/**
 * Convert inline Markdown syntax to HTML.
 * Process order: escape → images → links → bold → strikethrough →
 *   italic → inline code → inline LaTeX.
 */
function parseInline(text: string): string {
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Images ![alt](url)
  html = html.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    '<img src="$2" alt="$1" style="max-width:100%"/>'
  )

  // Links [text](url)
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener">$1</a>'
  )

  // Bold **text** or __text__
  html = html.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
  html = html.replace(/__(.+?)__/g, '<b>$1</b>')

  // Strikethrough ~~text~~
  html = html.replace(/~~(.+?)~~/g, '<s>$1</s>')

  // Italic *text* or _text_ — must run after bold to avoid ** conflicts
  html = html.replace(/\*(.+?)\*/g, '<i>$1</i>')
  html = html.replace(/_([^_]+)_/g, '<i>$1</i>')

  // Inline code `text`
  html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')

  // Inline LaTeX $...$ — match paired dollar signs (not escaped)
  // Must run last to avoid conflicts with other formatters
  html = html.replace(/\$([^$]+?)\$/g, '<span class="math-inline">$1</span>')

  return html
}

// ── Block-level line detectors ─────────────────────────────────────

function isHeaderLine(line: string): false | { level: number; text: string } {
  const match = line.match(/^(#{1,6})\s+(.+)$/)
  if (!match) return false
  return { level: match[1].length, text: match[2].trim() }
}

function isHorizontalRule(line: string): boolean {
  return /^(-{3,}|\*{3,}|_{3,})\s*$/.test(line.trim())
}

function isCodeFence(line: string): boolean {
  return line.trim().startsWith('```')
}

function isMathFence(line: string): boolean {
  return line.trim() === '$$'
}

function isUnorderedListItem(line: string): false | string {
  const match = line.match(/^[\-\*\+]\s+(.+)$/)
  if (!match) return false
  return match[1].trim()
}

function isOrderedListItem(line: string): false | string {
  const match = line.match(/^\d+\.\s+(.+)$/)
  if (!match) return false
  return match[1].trim()
}

function isChecklistItem(
  line: string
): false | { text: string; checked: boolean } {
  const match = line.match(/^[\-\*\+]\s+\[([ xX])\]\s+(.+)$/)
  if (!match) return false
  return { checked: match[1].toLowerCase() === 'x', text: match[2].trim() }
}

function isBlockquote(line: string): false | string {
  const match = line.match(/^>\s?(.*)$/)
  if (!match) return false
  return match[1] || ''
}

function isImageBlock(line: string): false | { url: string; alt: string } {
  const match = line.match(/^!\[([^\]]*)\]\(([^)]+)\)\s*$/)
  if (!match) return false
  return { alt: match[1], url: match[2] }
}

/** Detect a GFM table row: starts with |, ends with |, has at least one cell */
function isTableRow(line: string): false | string[] {
  const trimmed = line.trim()
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return false
  // Split by |, skip first/last empty parts, trim each cell
  const cells = trimmed
    .split('|')
    .slice(1, -1)
    .map((c) => c.trim())
  if (cells.length === 0) return false
  return cells
}

/** Detect the separator row: e.g. |---|---| */
function isTableSeparator(line: string): boolean {
  return /^\|[\s\-:]+\|[\s\-:|\s]*\|?\s*$/.test(line.trim())
}

// ── Block emitter ──────────────────────────────────────────────────

function emitBlock(acc: BlockAccumulator): EditorJSBlock | null {
  switch (acc.type) {
    case 'paragraph': {
      const text = acc.lines.join(' ')
      if (!text.trim()) return null
      return { type: 'paragraph', data: { text: parseInline(text) } }
    }

    case 'unorderedList':
      if (acc.items.length === 0) return null
      return {
        type: 'list',
        data: {
          style: 'unordered',
          items: acc.items.map((i) => parseInline(i)),
        },
      }

    case 'orderedList':
      if (acc.items.length === 0) return null
      return {
        type: 'list',
        data: {
          style: 'ordered',
          items: acc.items.map((i) => parseInline(i)),
        },
      }

    case 'blockquote': {
      const text = acc.lines.join(' ')
      if (!text.trim()) return null
      return {
        type: 'quote',
        data: { text: parseInline(text), caption: '', alignment: 'left' },
      }
    }

    case 'checklist':
      if (acc.items.length === 0) return null
      return {
        type: 'checklist',
        data: {
          items: acc.items.map((i) => ({
            text: parseInline(i.text),
            checked: i.checked,
          })),
        },
      }

    case 'codeBlock': {
      const code = acc.lines.join('\n')
      if (!code.trim()) return null
      return { type: 'code', data: { code, language: acc.language || '' } }
    }

    case 'mathBlock': {
      const latex = acc.lines.join('\n')
      if (!latex.trim()) return null
      return { type: 'math', data: { latex } }
    }

    case 'table': {
      if (acc.rows.length === 0) return null
      const hasHeader = acc.rows.length > 1
      return {
        type: 'table',
        data: {
          withHeadings: hasHeader,
          content: acc.rows.map((row) => row.map((c) => parseInline(c))),
        },
      }
    }
  }
}

// ── Main parser ────────────────────────────────────────────────────

export function markdownToEditorJS(markdown: string): EditorJSOutput {
  const blocks: EditorJSBlock[] = []
  const lines = markdown.split('\n')

  let current: BlockAccumulator | null = null
  let inCodeBlock = false
  let inMathBlock = false

  function flush() {
    if (!current) return
    const block = emitBlock(current)
    if (block) blocks.push(block)
    current = null
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]
    const line = rawLine.trimEnd()

    // ── Inside code fence ──────────────────────────────────────
    if (inCodeBlock) {
      if (isCodeFence(line)) {
        flush()
        inCodeBlock = false
        continue
      }
      if (!current || current.type !== 'codeBlock') {
        flush()
        current = { type: 'codeBlock', lines: [], language: '' }
      }
      ;(current as { type: 'codeBlock'; lines: string[]; language: string }).lines.push(line)
      continue
    }

    // Opening code fence — capture optional language hint (```python)
    if (isCodeFence(line)) {
      flush()
      const lang = line.trim().slice(3).trim()
      inCodeBlock = true
      current = { type: 'codeBlock', lines: [], language: lang }
      continue
    }

    // ── Inside math block ($$ ... $$) ───────────────────────────
    if (inMathBlock) {
      if (isMathFence(line)) {
        flush()
        inMathBlock = false
        continue
      }
      if (!current || current.type !== 'mathBlock') {
        flush()
        current = { type: 'mathBlock', lines: [] }
      }
      ;(current as { type: 'mathBlock'; lines: string[] }).lines.push(line)
      continue
    }

    // Opening math fence
    if (isMathFence(line)) {
      flush()
      inMathBlock = true
      continue
    }

    // ── Empty line → flush current block ───────────────────────
    if (line.trim() === '') {
      flush()
      continue
    }

    // ── Horizontal rule ────────────────────────────────────────
    if (isHorizontalRule(line)) {
      flush()
      blocks.push({ type: 'delimiter', data: {} })
      continue
    }

    // ── Image block (standalone) ───────────────────────────────
    const img = isImageBlock(line)
    if (img) {
      flush()
      blocks.push({
        type: 'image',
        data: {
          file: { url: img.url },
          caption: img.alt,
          withBorder: false,
          stretched: true,
          withBackground: false,
        },
      })
      continue
    }

    // ── Header ─────────────────────────────────────────────────
    const header = isHeaderLine(line)
    if (header) {
      flush()
      blocks.push({
        type: 'header',
        data: { text: parseInline(header.text), level: header.level },
      })
      continue
    }

    // ── Table: peek ahead to confirm contiguous table rows ──────
    const tableRow = isTableRow(line)
    if (tableRow && current?.type !== 'table') {
      // Look ahead for a separator row on the next line (or next non-empty)
      const nextLine = lines[i + 1]?.trim() ?? ''
      if (isTableSeparator(nextLine)) {
        flush()
        current = { type: 'table', rows: [tableRow] }
        continue
      }
      // If already in a table accumulator, keep collecting
    }

    // Inside a table, skip separator row and collect data rows
    if (current?.type === 'table') {
      if (isTableSeparator(line)) {
        // Skip the separator — don't add as data
        continue
      }
      const tr = isTableRow(line)
      if (tr) {
        ;(current as { type: 'table'; rows: string[][] }).rows.push(tr)
        continue
      }
      // Not a table row anymore → flush table and re-process this line
      flush()
      // fall through to re-evaluate the current line
      // (re-process without advancing index)
      i--
      continue
    }

    // ── Checklist item ─────────────────────────────────────────
    const checklist = isChecklistItem(line)
    if (checklist) {
      if (current && current.type !== 'checklist') flush()
      if (!current || current.type !== 'checklist') {
        current = { type: 'checklist', items: [] }
      }
      ;(current as { type: 'checklist'; items: { text: string; checked: boolean }[] }).items.push(
        checklist
      )
      continue
    }

    // ── Unordered list item ────────────────────────────────────
    const ulItem = isUnorderedListItem(line)
    if (ulItem) {
      if (current && current.type !== 'unorderedList') flush()
      if (!current || current.type !== 'unorderedList') {
        current = { type: 'unorderedList', items: [] }
      }
      ;(current as { type: 'unorderedList'; items: string[] }).items.push(ulItem)
      continue
    }

    // ── Ordered list item ──────────────────────────────────────
    const olItem = isOrderedListItem(line)
    if (olItem) {
      if (current && current.type !== 'orderedList') flush()
      if (!current || current.type !== 'orderedList') {
        current = { type: 'orderedList', items: [] }
      }
      ;(current as { type: 'orderedList'; items: string[] }).items.push(olItem)
      continue
    }

    // ── Blockquote ─────────────────────────────────────────────
    const quote = isBlockquote(line)
    if (quote !== false) {
      if (current && current.type !== 'blockquote') flush()
      if (!current || current.type !== 'blockquote') {
        current = { type: 'blockquote', lines: [] }
      }
      ;(current as { type: 'blockquote'; lines: string[] }).lines.push(quote)
      continue
    }

    // ── Default: paragraph ─────────────────────────────────────
    if (current && current.type !== 'paragraph') flush()
    if (!current || current.type !== 'paragraph') {
      current = { type: 'paragraph', lines: [] }
    }
    ;(current as { type: 'paragraph'; lines: string[] }).lines.push(line)
  }

  // Flush any remaining accumulator
  if (inCodeBlock && current && current.type === 'codeBlock') flush()
  if (inMathBlock && current && current.type === 'mathBlock') flush()
  flush()

  return {
    time: Date.now(),
    blocks,
    version: '2.28.0',
  }
}
