/**
 * Encoding detection and repair utilities.
 *
 * Handles common corruption patterns:
 * 1. GBK/GB2312 bytes decoded as UTF-8 → produces U+FFFD replacement chars
 * 2. Double encoding: UTF-8 bytes → Latin-1 → re-encoded as UTF-8
 */

// Unicode replacement character (U+FFFD) — definitive sign of encoding corruption
const REPLACEMENT_CHAR = '�'

// Regex matching Latin-1 Supplement block (U+00C0–U+00FF) — accented chars like À, Á, Ã, etc.
// These appear in runs when UTF-8 multi-byte sequences are decoded as Latin-1 then re-encoded as UTF-8
const LATIN1_SUPPLEMENT_RUN = /[À-ÿ]{4,}/

// Regex matching CJK Unified Ideographs (U+4E00–U+9FFF, U+3400–U+4DBF)
const CJK_RANGE = /[一-鿿㐀-䶿]/g

/** Check if text has signs of encoding corruption */
export function hasEncodingIssues(text: string): boolean {
  if (!text) return false

  // U+FFFD replacement characters — definitive sign of encoding corruption
  if (text.includes(REPLACEMENT_CHAR)) return true

  // Double-encoding pattern: multiple Latin-1 accented chars in a row
  // (characteristic of UTF-8 bytes decoded as Latin-1 then re-encoded)
  if (LATIN1_SUPPLEMENT_RUN.test(text)) {
    // Only flag if the text doesn't look like a legitimate European language
    // — check if CJK ratio is low despite being expected CJK content
    const cjkCount = (text.match(CJK_RANGE) || []).length
    const totalChars = text.replace(/\s/g, '').length
    // If we have Latin-1 runs but very few CJK chars, likely double-encoded Chinese
    if (totalChars > 10 && cjkCount / totalChars < 0.05) return true
  }

  return false
}

/**
 * Attempt to repair common encoding corruptions.
 * Returns the repaired text (or original if repair isn't possible).
 */
export function repairEncoding(text: string): { text: string; repaired: boolean } {
  if (!text) return { text, repaired: false }

  // Strategy 1: Try Latin-1 → UTF-8 re-decode (fixes double encoding)
  if (hasEncodingIssues(text)) {
    const redecoded = tryLatin1ToUtf8(text)
    if (redecoded !== text) {
      const origCjk = countCjk(redecoded)
      const origIssues = (text.match(/[�À-ÿ]/g) || []).length
      const newIssues = (redecoded.match(/[�À-ÿ]/g) || []).length
      if (origCjk > 0 && newIssues < origIssues) {
        return { text: redecoded, repaired: true }
      }
    }
  }

  // Strategy 2: Strip unrecoverable replacement chars
  if (text.includes(REPLACEMENT_CHAR)) {
    const cleaned = text
      .replace(new RegExp(REPLACEMENT_CHAR, 'g'), '')
      .replace(/\s{2,}/g, ' ')
      .trim()
    if (cleaned && cleaned !== text) {
      return { text: cleaned, repaired: true }
    }
  }

  return { text, repaired: false }
}

/**
 * Try to recover double-encoded UTF-8 by treating each char as a Latin-1 byte,
 * then decoding the resulting byte sequence as UTF-8.
 */
function tryLatin1ToUtf8(text: string): string {
  try {
    const bytes = new Uint8Array(text.length)
    for (let i = 0; i < text.length; i++) {
      bytes[i] = text.charCodeAt(i) & 0xff
    }
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes)
  } catch {
    return text
  }
}

/** Count CJK unified ideographs in text */
function countCjk(text: string): number {
  return (text.match(CJK_RANGE) || []).length
}

/**
 * Validate that content is safe for storage.
 * Returns { valid, text, warning } — text is the (possibly repaired) content.
 */
export function validateContent(
  content: string,
  label?: string
): { valid: boolean; text: string; warning?: string } {
  if (!content || !content.trim()) {
    return { valid: false, text: content, warning: 'Content is empty' }
  }

  const hasIssues = hasEncodingIssues(content)
  if (hasIssues) {
    const { text: repaired, repaired: wasRepaired } = repairEncoding(content)
    if (wasRepaired) {
      console.warn(
        `[encoding] Repaired corrupted content${label ? ` (${label})` : ''}: ` +
        `original=${content.substring(0, 60)}... → repaired=${repaired.substring(0, 60)}...`
      )
      return { valid: true, text: repaired, warning: 'Content encoding was repaired' }
    }
    // Could not repair — still accept but warn
    console.warn(
      `[encoding] Content has encoding issues that could not be repaired${label ? ` (${label})` : ''}: ` +
      content.substring(0, 80)
    )
    return { valid: true, text: content, warning: 'Content may have encoding issues' }
  }

  return { valid: true, text: content }
}
