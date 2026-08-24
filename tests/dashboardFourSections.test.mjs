import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const workspace = readFileSync('components/program-dashboard/TierAwareDashboardWorkspace.tsx', 'utf8')
const ember = readFileSync('components/program-dashboard/EmberDashboard.tsx', 'utf8')
const ignite = readFileSync('components/program-dashboard/IgniteDashboard.tsx', 'utf8')
const phoenix = readFileSync('components/program-dashboard/PhoenixDashboard.tsx', 'utf8')
const tierDashboards = [ember, ignite, phoenix].join('\n')
const tutorial = readFileSync('lib/tutorial/registry.ts', 'utf8')
const css = readFileSync('app/globals.css', 'utf8')

test('tier dashboards no longer render standalone removed dashboard sections', () => {
  for (const removed of [
    'Daily Actions',
    'Macro Targets',
    "Today&apos;s Plan",
    'Progress Photos',
    'Weekly Trends',
    'DashboardProgressLinks',
    'StreakRequirementsCard',
  ]) {
    assert.equal(tierDashboards.includes(removed), false, `${removed} should not render as a standalone dashboard section`)
  }
})

test('shared dashboard owns the final four-section structure', () => {
  assert.match(workspace, /Today&apos;s Insight/)
  assert.match(workspace, /data-tutorial-id="dashboard-calendar"/)
  assert.match(workspace, /data-tutorial-id="dashboard-whats-next"/)
  assert.match(workspace, /dashboard-progress-area/)
  assert.match(workspace, /'progress', 'assessments', 'trends'/)
})

test('calendar day view contains Today plan daypart switching', () => {
  assert.match(workspace, /type Daypart = 'morning' \| 'midday' \| 'evening'/)
  assert.match(workspace, /tier-daypart-control/)
  assert.match(workspace, /calendar-daypart-plan/)
  assert.match(workspace, /setSelectedDate\(date\)/)
})

test('progress tab consolidates daily actions, macro targets, and cycle tracker', () => {
  assert.match(workspace, /data-testid="dashboard-daily-actions"/)
  assert.match(workspace, /Macro Targets/)
  assert.match(workspace, /data-testid="cycle-tracker"/)
  assert.match(workspace, /Track your cycle/)
  assert.match(workspace, /tier === 'ember' \? \[logic\.nutrition\.calories\]/)
})

test('assessments tab relocates photos and preserves posture tier language', () => {
  assert.match(workspace, /Progress Photos/)
  assert.match(workspace, /Assessment Photos/)
  assert.match(workspace, /Strength Assessment/)
  assert.match(workspace, /Measurements/)
  assert.match(workspace, /Posture Assessment/)
  assert.match(workspace, /capabilities\.postureAssessment/)
  assert.match(workspace, /Not included in Ember/)
})

test('trends tab renders existing trend data in the consolidated panel', () => {
  assert.match(workspace, /logic\.trends\.map/)
  assert.match(workspace, /tier-trend-line/)
  assert.match(workspace, /data-testid="dashboard-trends-tab"/)
})

test('responsive layout stacks calendar and what next on small screens', () => {
  assert.match(css, /@media\(max-width:860px\).*\.tier-dashboard-row\{grid-template-columns:1fr\}/s)
})

test('tutorial targets the simplified dashboard sections', () => {
  for (const targetId of [
    'dashboard-daily-insight',
    'dashboard-calendar',
    'dashboard-whats-next',
    'dashboard-progress-area',
  ]) {
    assert.match(tutorial, new RegExp(targetId))
  }
  assert.match(tutorial, /Morning, Midday, and Evening/)
  assert.doesNotMatch(tutorial, /standalone dashboard cards/)
})
