import type { PlatformActionResult, PlatformRouteCheck } from '../../adapters/adapter.types'
import type { FunctionalCheckResult } from './functional.types'

export const defaultAosQaRoutes = ['/aos/qa', '/aos/qa/api/run', '/aos/qa/api/daily', '/aos/qa/api/reports']

export function routeChecksToFunctionalResults(routeChecks: PlatformRouteCheck[]): FunctionalCheckResult[] {
  return routeChecks.map((check) => ({
    kind: 'route-availability',
    passed: check.available,
    area: check.route,
    title: `Route availability: ${check.route}`,
    expected: { available: true, status: 200 },
    actual: { available: check.available, status: check.status },
    message: check.message,
  }))
}

export function actionResultToFunctionalChecks(result: PlatformActionResult): FunctionalCheckResult[] {
  return [
    {
      kind: 'action-completion',
      passed: result.completed,
      area: result.action,
      title: `Action completes: ${result.action}`,
      expected: true,
      actual: result.completed,
      message: result.message,
    },
    {
      kind: 'response-shape',
      passed: result.responseShapeValid,
      area: result.action,
      title: `Response shape valid: ${result.action}`,
      expected: true,
      actual: result.responseShapeValid,
    },
    {
      kind: 'persistence',
      passed: result.persisted,
      area: result.action,
      title: `Persistence succeeds: ${result.action}`,
      expected: true,
      actual: result.persisted,
    },
  ]
}
