const AI_CREDENTIALS_ENCRYPTION_KEY_ENV_VAR = 'AI_CREDENTIALS_ENCRYPTION_KEY'
const KEY_LENGTH_BYTES = 32

function decodeBase64Key(encodedKey: string): Uint8Array {
  const decodedKey = Buffer.from(encodedKey, 'base64')

  if (
    decodedKey.byteLength === 0 ||
    decodedKey.toString('base64') !== encodedKey
  ) {
    throw new Error(
      `${AI_CREDENTIALS_ENCRYPTION_KEY_ENV_VAR} must be a valid base64-encoded encryption key`,
    )
  }

  if (decodedKey.byteLength !== KEY_LENGTH_BYTES) {
    throw new Error(
      `${AI_CREDENTIALS_ENCRYPTION_KEY_ENV_VAR} must decode to ${KEY_LENGTH_BYTES} bytes`,
    )
  }

  return decodedKey
}

export function getEncryptionKey(
  environment: NodeJS.ProcessEnv = process.env,
): Uint8Array {
  const encodedKey = environment[AI_CREDENTIALS_ENCRYPTION_KEY_ENV_VAR]?.trim()

  if (!encodedKey) {
    throw new Error(
      `${AI_CREDENTIALS_ENCRYPTION_KEY_ENV_VAR} must be configured before starting the server`,
    )
  }

  return decodeBase64Key(encodedKey)
}
