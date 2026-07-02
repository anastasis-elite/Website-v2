import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'

function encryptionKey() {
  const secret = process.env.TIKTOK_TOKEN_ENCRYPTION_KEY
  if (!secret) throw new Error('TIKTOK_TOKEN_ENCRYPTION_KEY is not configured.')
  return createHash('sha256').update(secret).digest()
}

export function encryptTikTokToken(value: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return ['v1', iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join(':')
}

export function decryptTikTokToken(value: string) {
  const [version, iv, tag, encrypted] = value.split(':')
  if (version !== 'v1' || !iv || !tag || !encrypted) {
    throw new Error('Stored TikTok token is invalid.')
  }

  const decipher = createDecipheriv(
    'aes-256-gcm',
    encryptionKey(),
    Buffer.from(iv, 'base64url')
  )
  decipher.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}
