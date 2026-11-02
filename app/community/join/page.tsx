import FreeCommunityJoin from '@/components/membership/FreeCommunityJoin'

export default async function FreeCommunityJoinPage({ searchParams }: { searchParams: Promise<{ verification?: string }> }) {
  const params = await searchParams
  return <FreeCommunityJoin verificationFailed={params.verification === 'failed'} />
}
