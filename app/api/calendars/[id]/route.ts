export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 180
import { connectionPATCH, connectionDELETE } from '@/lib/calendar/api-handlers'
type Params = { params: Promise<{id: string}> }
export const PATCH = async (request: Request, {params}: Params) => connectionPATCH(request,(await params).id)
export const DELETE = async (request: Request, {params}: Params) => connectionDELETE(request,(await params).id)
