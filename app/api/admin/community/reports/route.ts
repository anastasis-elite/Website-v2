import { communityOperatorResponse, listCommunityReports, readCommunityJson, reviewCommunityReport } from '@/lib/community/operations'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  return communityOperatorResponse(request, false, operator => listCommunityReports(operator, new URL(request.url)))
}
export async function POST(request: Request) {
  return communityOperatorResponse(request, true, async operator => reviewCommunityReport(operator, await readCommunityJson(request)))
}
