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

// Regex matching CJK-related punctuation and symbols that commonly appear in Chinese text
// U+3000–U+303F (CJK Symbols), U+FF00–U+FFEF (Fullwidth forms), U+2000–U+206F (General Punctuation)
const CJK_PUNCT_RANGE = /[　-〿＀-￯ -⁯]/g

/**
 * Characters whose low byte is in the UTF-8 continuation range (0x80–0xBF).
 * When a CJK UTF-8 byte sequence is decoded as Latin-1, continuation bytes
 * land in U+0080–U+00BF. These mixed with other scripts signal corruption.
 */
const UTF8_CONTINUATION_LIKE = /[-¿]/

/** Check if text has signs of encoding corruption */
export function hasEncodingIssues(text: string): boolean {
  if (!text) return false

  // 1. U+FFFD replacement characters — definitive sign of encoding corruption
  if (text.includes(REPLACEMENT_CHAR)) return true

  const nonAscii = [...text].filter((c) => c.charCodeAt(0) > 127)
  if (nonAscii.length === 0) return false

  // 2. Count by character category
  let cjk = 0
  let cjkPunct = 0
  let latin = 0 // Latin-1 Supplement / Latin Extended
  let suspicious = 0 // Everything else non-ASCII

  for (const c of nonAscii) {
    const code = c.charCodeAt(0)
    if ((code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3400 && code <= 0x4dbf)) {
      cjk++
    } else if (
      (code >= 0x3000 && code <= 0x303f) || // CJK Symbols
      (code >= 0xff00 && code <= 0xffef) || // Fullwidth forms
      (code >= 0x2000 && code <= 0x206f)    // General punctuation
    ) {
      cjkPunct++
    } else if (
      (code >= 0x00c0 && code <= 0x024f) || // Latin-1 Supplement + Latin Extended
      (code >= 0x1e00 && code <= 0x1eff)    // Latin Extended Additional
    ) {
      latin++
    } else {
      suspicious++
    }
  }

  const total = nonAscii.length

  // 3. Mixed-script corruption: many chars from unexpected Unicode blocks
  //    Garbled Chinese typically produces scattered characters across
  //    Hebrew, Arabic, Cyrillic, IPA, and other blocks.
  //    Valid Chinese text: CJK + CJK punctuation should dominate.
  if (suspicious > 0) {
    const nativeScript = cjk + cjkPunct
    // If suspicious chars outnumber native CJK script, likely corrupted
    if (suspicious >= nativeScript && cjk < total * 0.3) return true
    // If we have suspicious chars but virtually no CJK, definitely corrupted
    if (cjk === 0 && suspicious >= 3) return true
  }

  // 4. UTF-8 continuation byte pattern: scattered U+0080–U+00BF chars
  //    (classic double-encoding — UTF-8 bytes as Latin-1 then re-encoded)
  const continuationCount = (text.match(UTF8_CONTINUATION_LIKE) || []).length
  if (continuationCount >= 3 && cjk < total * 0.2) return true

  // 5. Latin-1 Supplement runs (existing heuristic)
  if (LATIN1_SUPPLEMENT_RUN.test(text)) {
    if (total > 10 && cjk / total < 0.05) return true
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
  const redecoded = tryLatin1ToUtf8(text)
  if (redecoded !== text) {
    const redecodedCjk = countCjk(redecoded)
    const origIssues = (text.match(/[�À-ÿ]/g) || []).length
    const newIssues = (redecoded.match(/[�À-ÿ]/g) || []).length
    // Repair is valid if it produces MORE CJK characters and FEWER issue chars
    if (redecodedCjk > 0 && (newIssues < origIssues || redecodedCjk > countCjk(text) * 2)) {
      return { text: redecoded, repaired: true }
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
    // Could not repair — reject (return valid: false so caller can block storage)
    console.warn(
      `[encoding] Content has encoding issues that could not be repaired${label ? ` (${label})` : ''}: ` +
      content.substring(0, 80)
    )
    return { valid: false, text: content, warning: 'Content encoding is corrupted and could not be repaired' }
  }

  return { valid: true, text: content }
}
