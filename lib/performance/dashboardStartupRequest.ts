import 'server-only'

import { cache } from 'react'
import { createDashboardRequestTiming } from './dashboardRequest'

// React owns this cache for one server render request. Layout and page work can
// share a clock without retaining timings or member data between requests.
export const getDashboardStartupTiming = cache(() => createDashboardRequestTiming())
