import CryptoJS from 'crypto-js'

/**
 * Encrypt a plaintext string with the given key using AES-256.
 * Returns the encrypted ciphertext as a Base64 string.
 */
export function encrypt(data: string, key: string): string {
  return CryptoJS.AES.encrypt(data, key).toString()
}

/**
 * Decrypt a ciphertext string (produced by `encrypt`) with the given key.
 * Returns the original plaintext string.
 */
export function decrypt(data: string, key: string): string {
  return CryptoJS.AES.decrypt(data, key).toString(CryptoJS.enc.Utf8)
}

/**
 * Encrypt with the master key (MASTER_ENCRYPTION_KEY env var).
 * Server-side only — throws if the env var is not set.
 */
export function encryptWithMaster(data: string): string {
  const masterKey = process.env.MASTER_ENCRYPTION_KEY
  if (!masterKey) {
    throw new Error(
      'MASTER_ENCRYPTION_KEY environment variable is not set. ' +
        'This function must only be called server-side.'
    )
  }
  return encrypt(data, masterKey)
}

/**
 * Decrypt with the master key (MASTER_ENCRYPTION_KEY env var).
 * Server-side only — throws if the env var is not set.
 */
export function decryptWithMaster(data: string): string {
  const masterKey = process.env.MASTER_ENCRYPTION_KEY
  if (!masterKey) {
    throw new Error(
      'MASTER_ENCRYPTION_KEY environment variable is not set. ' +
        'This function must only be called server-side.'
    )
  }
  return decrypt(data, masterKey)
}
