import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const FORMAT_VERSION = 1
const IV_LENGTH_BYTES = 12
const KEY_LENGTH_BYTES = 32

export interface EncryptedSecret {
  algorithm: typeof ALGORITHM
  authTag: string
  ciphertext: string
  iv: string
  keyVersion: string
  version: typeof FORMAT_VERSION
}

function validateKey(key: Uint8Array): void {
  if (key.byteLength !== KEY_LENGTH_BYTES) {
    throw new Error(`Encryption key must be ${KEY_LENGTH_BYTES} bytes`)
  }
}

function validateKeyVersion(keyVersion: string): void {
  if (!keyVersion.trim()) {
    throw new Error('Encryption key version must not be empty')
  }
}

export function encryptSecret(
  plaintext: string,
  key: Uint8Array,
  keyVersion: string,
): EncryptedSecret {
  validateKey(key)
  validateKeyVersion(keyVersion)

  const iv = randomBytes(IV_LENGTH_BYTES)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])

  return {
    algorithm: ALGORITHM,
    authTag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    keyVersion,
    version: FORMAT_VERSION,
  }
}

export function decryptSecret(
  payload: EncryptedSecret,
  key: Uint8Array,
): string {
  validateKey(key)

  if (payload.algorithm !== ALGORITHM || payload.version !== FORMAT_VERSION) {
    throw new Error('Unsupported encrypted secret format')
  }
  validateKeyVersion(payload.keyVersion)

  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(payload.iv, 'base64'),
  )
  decipher.setAuthTag(Buffer.from(payload.authTag, 'base64'))

  return Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8')
}
