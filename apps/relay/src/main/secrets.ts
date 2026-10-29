import { app, safeStorage } from 'electron'
import type { SecretBox } from '@dulidan/mail-core'

/**
 * Passwords are encrypted with Electron safeStorage, which uses the key
 * store of the operating system (Windows: DPAPI, macOS: Keychain, Linux:
 * Secret Service). Without a real key store no password is saved at all.
 */
export const systemSecretBox: SecretBox = {
  isAvailable: () => {
    if (!safeStorage.isEncryptionAvailable()) return false
    // On Linux without a key ring Electron would fall back to a fixed key: not safe enough.
    return process.platform !== 'linux' || safeStorage.getSelectedStorageBackend() !== 'basic_text'
  },
  encrypt: (plain) => safeStorage.encryptString(plain).toString('base64'),
  decrypt: (cipher) => safeStorage.decryptString(Buffer.from(cipher, 'base64'))
}

/**
 * Only for automated tests in a development build (never in the installed
 * app): containers have no key store, so a reversible stand-in is used.
 */
export function testSecretBox(): SecretBox | null {
  if (app.isPackaged || process.env['RELAY_TEST_MODE'] !== '1') return null
  return {
    isAvailable: () => true,
    encrypt: (plain) => 'test:' + Buffer.from(plain).toString('base64'),
    decrypt: (cipher) => Buffer.from(cipher.slice(5), 'base64').toString()
  }
}
