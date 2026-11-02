import { assertCommunityOrigin, communityIdentity, communityResponse, listCommunityPosts, readCommunityJson, reserveCommunityPost } from '@/lib/community/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  return communityResponse(async () => {
    const identity = await communityIdentity()
    return Response.json(await listCommunityPosts(identity, new URL(request.url).searchParams.get('cursor')), { headers: { 'Cache-Control': 'private, no-store' } })
  })
}

export async function POST(request: Request) {
  return communityResponse(async () => {
    assertCommunityOrigin(request)
    const identity = await communityIdentity()
    return Response.json(await reserveCommunityPost(identity, await readCommunityJson(request)), { headers: { 'Cache-Control': 'private, no-store' } })
  })
}
