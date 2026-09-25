import { NextResponse } from 'next/server'

export function safeErrorResponse(
  message = 'Request failed.',
  status = 500,
  log?: unknown,
) {
  if (log) {
    console.error(message, log)
  }

  return NextResponse.json({ error: message }, { status })
}

export function parseJsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}
