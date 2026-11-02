import { cleanupCommunity, communityOperatorResponse, readCommunityJson } from '@/lib/community/operations'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: Request) {
  return communityOperatorResponse(request, true, async operator => cleanupCommunity(operator, await readCommunityJson(request)))
}
