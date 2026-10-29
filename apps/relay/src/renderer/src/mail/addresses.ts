import type { Address } from '../../../shared/ipc'

const EMAIL = /^[^\s@<>"(),;]+@[^\s@<>"(),;]+\.[^\s@<>"(),;]+$/

export interface ParsedAddresses {
  addresses: Address[]
  /** Parts that are no valid address. */
  invalid: string[]
}

/** Splits at commas and semicolons that are not inside quotes. */
function splitList(text: string): string[] {
  const parts: string[] = []
  let current = ''
  let quoted = false
  for (const char of text) {
    if (char === '"') quoted = !quoted
    if ((char === ',' || char === ';') && !quoted) {
      parts.push(current)
      current = ''
    } else {
      current += char
    }
  }
  parts.push(current)
  return parts.map((part) => part.trim()).filter(Boolean)
}

/** Reads what the user typed: "Anna <anna@x.de>, bernd@y.de; \"Müller, Jo\" <jo@z.de>" */
export function parseAddressList(text: string): ParsedAddresses {
  const result: ParsedAddresses = { addresses: [], invalid: [] }
  const seen = new Set<string>()
  for (const part of splitList(text)) {
    const match = /^(.*?)\s*<([^<>]+)>$/.exec(part)
    const name = match ? match[1]!.trim().replace(/^"|"$/g, '') : ''
    const address = (match ? match[2]! : part).trim()
    if (!EMAIL.test(address)) {
      result.invalid.push(part)
      continue
    }
    const key = address.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.addresses.push({ name, address })
  }
  return result
}

/** Back to text for the input field. */
export function formatAddressList(list: Address[]): string {
  return list.map((entry) => (entry.name ? `${/[,;"]/.test(entry.name) ? `"${entry.name.replace(/"/g, '')}"` : entry.name} <${entry.address}>` : entry.address)).join(', ')
}

export function displayName(entry: Address | null | undefined): string {
  if (!entry) return ''
  return entry.name || entry.address
}
