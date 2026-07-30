import type { PlatformAdapter } from './adapter.types'

export type CreateRealPlatformAdapterOptions = {
  baseUrl: string
}

export function createRealPlatformAdapterPlaceholder(_options: CreateRealPlatformAdapterOptions): PlatformAdapter {
  throw new Error(
    'Real platform adapter is not implemented inside app/aos/qa. Add browser/app integration later without changing this mock default.',
  )
}
