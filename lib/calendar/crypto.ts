import 'server-only'
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto'

function key() {
 const value = process.env.CALENDAR_CREDENTIAL_ENCRYPTION_KEY || ''
 if (!/^[A-Za-z0-9+/]{43}=$/.test(value)) throw new Error('Calendar encryption is not configured.')
 const result = Buffer.from(value, 'base64')
 if (result.length !== 32) throw new Error('Calendar encryption is not configured.')
 return result
}
export function seal(value: unknown, owner: string) {
 const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key(), iv)
 cipher.setAAD(Buffer.from(owner))
 const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()])
 return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), ciphertext.toString('base64')].join('.')
}
export function unseal<T>(value: string, owner: string): T {
 const [version, nonce, tag, encrypted] = value.split('.')
 if(version !== 'v1' || !nonce || !tag || !encrypted) throw new Error('Calendar credentials could not be read.')
 const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(nonce,'base64'))
 decipher.setAAD(Buffer.from(owner)); decipher.setAuthTag(Buffer.from(tag,'base64'))
 return JSON.parse(Buffer.concat([decipher.update(Buffer.from(encrypted,'base64')),decipher.final()]).toString('utf8'))
}
export const digest = (value: string) => createHash('sha256').update(value).digest('hex')
