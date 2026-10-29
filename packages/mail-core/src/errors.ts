/** Simple error codes the apps can turn into plain-language messages. */
export type MailErrorCode =
  | 'auth-failed'
  | 'server-not-found'
  | 'connection-failed'
  | 'timeout'
  | 'tls-failed'
  | 'too-many-recipients'
  | 'daily-limit'
  | 'no-trash-folder'
  | 'already-in-trash'
  | 'secret-storage-unavailable'
  | 'not-found'
  | 'unknown'

export class MailError extends Error {
  constructor(
    readonly code: MailErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'MailError'
  }
}

/** Maps errors of ImapFlow, Nodemailer and Node sockets to a code. */
export function classifyError(error: unknown): MailErrorCode {
  if (error instanceof MailError) return error.code
  const value = error as { code?: string; authenticationFailed?: boolean; responseCode?: number; message?: string; name?: string } | null
  if (!value) return 'unknown'
  if (value.name === 'SecretStorageUnavailableError') return 'secret-storage-unavailable'
  if (value.name === 'TooManyRecipientsError') return 'too-many-recipients'
  if (value.name === 'DailyLimitReachedError') return 'daily-limit'
  if (value.authenticationFailed || value.code === 'EAUTH' || value.responseCode === 535) return 'auth-failed'
  if (value.code === 'ENOTFOUND' || value.code === 'EAI_AGAIN') return 'server-not-found'
  if (value.code === 'ETIMEDOUT' || value.code === 'ETIMEOUT' || value.code === 'CONNECT_TIMEOUT' || value.code === 'GREETING_TIMEOUT') return 'timeout'
  if (value.code && /CERT|SELF_SIGNED|TLS|SSL/i.test(value.code)) return 'tls-failed'
  if (/certificate|tls|ssl/i.test(value.message ?? '')) return 'tls-failed'
  if (value.code === 'ECONNREFUSED' || value.code === 'ECONNRESET' || value.code === 'ESOCKET' || value.code === 'ECONNECTION' || value.code === 'NoConnection') {
    return 'connection-failed'
  }
  if (/authentication|invalid credentials|login/i.test(value.message ?? '')) return 'auth-failed'
  return 'unknown'
}
