export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 180
import { eventsWrite } from '@/lib/calendar/api-handlers'
type Params = { params: Promise<{id: string}> }
export const PATCH = async (request: Request, {params}: Params) => eventsWrite(request,(await params).id)
export const DELETE = async (request: Request, {params}: Params) => eventsWrite(request,(await params).id)
