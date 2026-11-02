import { assertCommunityOrigin, communityIdentity, communityResponse, deleteCommunityPost } from '@/lib/community/server'

export const runtime = 'nodejs'

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  return communityResponse(async () => {
    assertCommunityOrigin(request)
    // Removing one's own media remains possible after membership ends.
    const identity = await communityIdentity(true)
    return Response.json(await deleteCommunityPost(identity, (await context.params).id), { headers: { 'Cache-Control': 'private, no-store' } })
  })
}
