export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 180
import { eventsWrite } from '@/lib/calendar/api-handlers'
export { eventsGET as GET } from '@/lib/calendar/api-handlers'
export const POST = (request: Request) => eventsWrite(request)
