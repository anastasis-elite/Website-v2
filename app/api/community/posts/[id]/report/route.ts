import { assertCommunityOrigin, communityIdentity, communityResponse, readCommunityJson, reportCommunityPost } from '@/lib/community/server'

export const runtime = 'nodejs'

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return communityResponse(async () => {
    assertCommunityOrigin(request)
    const identity = await communityIdentity()
    return Response.json(await reportCommunityPost(identity, (await context.params).id, await readCommunityJson(request)), { headers: { 'Cache-Control': 'private, no-store' } })
  })
}
