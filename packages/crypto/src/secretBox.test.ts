import assert from 'node:assert/strict'
import { test } from 'node:test'
import { decryptSecret, encryptSecret } from './secretBox.js'

const key = Buffer.alloc(32, 7)

test('encrypts and decrypts a secret with authenticated metadata', () => {
  const encrypted = encryptSecret('provider-secret', key, 'active')

  assert.equal(decryptSecret(encrypted, key), 'provider-secret')
  assert.equal(encrypted.algorithm, 'aes-256-gcm')
  assert.equal(encrypted.version, 1)
  assert.notEqual(encrypted.ciphertext, 'provider-secret')
})

test('uses a unique IV for repeated encryption of the same secret', () => {
  const first = encryptSecret('provider-secret', key, 'active')
  const second = encryptSecret('provider-secret', key, 'active')

  assert.notEqual(first.iv, second.iv)
  assert.notEqual(first.ciphertext, second.ciphertext)
})

test('rejects tampered ciphertext and authentication metadata', () => {
  const encrypted = encryptSecret('provider-secret', key, 'active')

  assert.throws(() => {
    decryptSecret(
      { ...encrypted, ciphertext: Buffer.from('tampered').toString('base64') },
      key,
    )
  })

  assert.throws(() => {
    decryptSecret(
      { ...encrypted, authTag: Buffer.alloc(16).toString('base64') },
      key,
    )
  })
})
