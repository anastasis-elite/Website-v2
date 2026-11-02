import { assertCommunityOrigin, communityIdentity, communityResponse, publishCommunityPost } from '@/lib/community/server'

export const runtime = 'nodejs'

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return communityResponse(async () => {
    assertCommunityOrigin(request)
    const identity = await communityIdentity()
    return Response.json(await publishCommunityPost(identity, (await context.params).id), { headers: { 'Cache-Control': 'private, no-store' } })
  })
}
