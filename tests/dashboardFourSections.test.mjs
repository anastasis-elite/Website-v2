import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const home = readFileSync('components/program-dashboard/TierAwareDashboardWorkspace.tsx', 'utf8')
const workspace = readFileSync('components/program-dashboard/DashboardDetailPanels.tsx', 'utf8')
const calendar = readFileSync('components/program-dashboard/DashboardCalendar.tsx', 'utf8')
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

test('shared home keeps guided Today while removed dropdowns leave dedicated detail modules intact', () => {
  const today = readFileSync('components/program-dashboard/GuidedToday.tsx', 'utf8')
  assert.match(home, /<GuidedToday[^\n]*logic=\{logic\} schedule=\{schedule\}/)
  assert.match(today, /aria-label="Your day at a glance"/)
  assert.match(today, /data-testid="today-progress"/)
  assert.match(today, /data-testid="guided-next-step"/)
  assert.match(home, /data-quiet=\{quiet\}/)
  for (const removed of ['<summary>Your schedule at a glance', '<DailyDisplayPreferences', '<summary>Progress, assessments, and details']) assert.equal(home.includes(removed), false)
  for (const name of ['ProgressTab', 'AssessmentsTab', 'TrendsTab', 'SchedulePreview', 'buildPlanBlocks']) assert.match(workspace, new RegExp(`export function ${name}`))
  assert.match(calendar, /export default function DashboardCalendar/)
})

test('calendar day view contains Today plan daypart switching', () => {
  assert.match(calendar, /type Daypart = 'morning' \| 'midday' \| 'evening'/)
  assert.match(calendar, /tier-daypart-control/)
  assert.match(calendar, /calendar-daypart-plan/)
  assert.match(calendar, /setSelectedDate\(date\)/)
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
