export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 180
import { connectionSync } from '@/lib/calendar/api-handlers'
export const POST = async (request: Request, {params}: {params:Promise<{id:string}>}) => connectionSync(request,(await params).id)
