import { communityIdentity, communityMediaResponse, communityResponse } from '@/lib/community/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return communityResponse(async () => communityMediaResponse(await communityIdentity(), (await context.params).id, request))
}
