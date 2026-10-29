import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { SecretBox } from '../src/accounts'
import type { ParsedMail } from '../src/types'

/** Stand-in for the operating system key store: reversible, but never plain text. */
export const fakeSecrets: SecretBox = {
  isAvailable: () => true,
  encrypt: (plain) => 'enc:' + Buffer.from(plain, 'utf8').toString('base64').split('').reverse().join(''),
  decrypt: (cipher) => Buffer.from(cipher.slice(4).split('').reverse().join(''), 'base64').toString('utf8')
}

export async function tempDir(): Promise<{ dir: string; cleanup: () => Promise<void> }> {
  const dir = await mkdtemp(join(tmpdir(), 'mail-core-'))
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) }
}

export function mail(uid: number, patch: Partial<ParsedMail> = {}): ParsedMail {
  return {
    uid,
    messageId: `<m${uid}@example.com>`,
    inReplyTo: null,
    references: [],
    subject: `Betreff ${uid}`,
    from: { name: 'Anna Beispiel', address: 'anna@example.com' },
    to: [{ name: '', address: 'ich@example.com' }],
    cc: [],
    replyTo: [],
    date: Date.UTC(2026, 9, 1, 10, uid),
    seen: false,
    text: `Text der Mail ${uid}`,
    html: null,
    attachments: [],
    size: 100,
    ...patch
  }
}
