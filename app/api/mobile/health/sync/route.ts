import { NextResponse } from 'next/server'

import { completeHealthSync, getHealthIntegration, healthSyncWindow, upsertHealthIntegration } from '@/lib/health/service'
import type { HealthIntegrationState, HealthProvider, HealthPlatform } from '@/lib/health/types'
import { createMobileRequestContext } from '@/lib/mobile/auth'
import { buildMobileDailyState } from '@/lib/mobile/dailyState'
import { getProgramLogicForClient } from '@/lib/dashboard/logic/getProgramLogicForClient'
import { getDailyScheduleState } from '@/lib/schedule/service'

function providerForPlatform(platform: string): HealthProvider | null {
  if (platform === 'ios') return 'apple_health'
  if (platform === 'android') return 'health_connect'
  return null
}

function platformIsSupported(platform: string): platform is HealthPlatform {
  return platform === 'ios' || platform === 'android'
}

export async function GET(request: Request) {
  try {
    const context = await createMobileRequestContext(request)
    if ('error' in context) {
      return NextResponse.json({ error: context.error }, { status: context.status })
    }

    const url = new URL(request.url)
    const provider = url.searchParams.get('provider') as HealthProvider | null
    const platform = url.searchParams.get('platform') || ''
    const resolvedProvider = provider || providerForPlatform(platform)

    if (!resolvedProvider) {
      return NextResponse.json({ error: 'Unsupported health provider.' }, { status: 400 })
    }

    const integration = await getHealthIntegration({
      supabase: context.supabase,
      userId: context.user.id,
      provider: resolvedProvider,
    })

    return NextResponse.json({
      integration,
      syncWindow: healthSyncWindow(integration?.last_successful_sync_at),
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Health integration status could not be loaded.' },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const context = await createMobileRequestContext(request)
    if ('error' in context) {
      return NextResponse.json({ error: context.error }, { status: context.status })
    }

    const body = await request.json()
    const platform = String(body.platform || '')
    const provider = String(body.provider || providerForPlatform(platform)) as HealthProvider

    if (!platformIsSupported(platform) || !providerForPlatform(platform)) {
      return NextResponse.json({ error: 'Unsupported health platform.' }, { status: 400 })
    }

    if (provider !== providerForPlatform(platform)) {
      return NextResponse.json({ error: 'Provider does not match platform.' }, { status: 400 })
    }

    const startedAt = new Date().toISOString()
    const integration: HealthIntegrationState = {
      provider,
      platform,
      connection_status: body.available === false ? 'unavailable' : 'connected',
      permission_status: body.permissionStatus || 'unknown',
      sync_status: 'syncing',
      last_sync_started_at: startedAt,
      provider_sync_state:
        body.providerSyncState && typeof body.providerSyncState === 'object'
          ? body.providerSyncState
          : {},
      last_error: null,
    }

    await upsertHealthIntegration({
      supabase: context.supabase,
      userId: context.user.id,
      clientId: context.client.client_id,
      state: integration,
    })

    const result = await completeHealthSync({
      supabase: context.supabase,
      userId: context.user.id,
      client: context.client,
      integration,
      samples: Array.isArray(body.samples) ? body.samples : [],
      syncStatus: body.syncStatus || 'success',
      lastError: typeof body.lastError === 'string' ? body.lastError : null,
    })

    const logic = await getProgramLogicForClient(context)
    const schedule = await getDailyScheduleState({
      supabase: context.supabase,
      user: context.user,
      client: context.client,
      logic,
    })

    return NextResponse.json({
      success: true,
      imported: result.imported,
      aggregates: result.aggregates,
      integration: result.integration,
      dailyState: buildMobileDailyState(logic),
      schedule,
      nextAction: schedule.nextAction,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Health sync failed.' },
      { status: 500 },
    )
  }
}
