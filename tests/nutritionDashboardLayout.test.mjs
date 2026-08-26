import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const dashboard = readFileSync('components/AdaptiveNutritionDashboard.tsx', 'utf8')
const css = readFileSync('app/globals.css', 'utf8')

test('nutrition dashboard uses objective, two-panel row, and full-width management panel', () => {
  assert.match(dashboard, /data-testid="nutrition-objective"/)
  assert.match(dashboard, /className="nutrition-dashboard-row"/)
  assert.match(dashboard, /data-testid="nutrition-progress-panel"/)
  assert.match(dashboard, /data-testid="nutrition-intake-panel"/)
  assert.match(dashboard, /data-testid="nutrition-management-panel"/)
  assert.match(css, /\.nutrition-dashboard-row\{display:grid;grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)/)
  assert.match(css, /@media\(max-width:860px\).*\.nutrition-dashboard-row.*grid-template-columns:1fr/s)
})

test('nutrition dashboard exposes progress, intake, and management tab systems', () => {
  assert.match(dashboard, /type ProgressTab = 'daily' \| 'trends'/)
  assert.match(dashboard, /type IntakeTab = 'water' \| 'meal'/)
  assert.match(dashboard, /type ManagementTab = 'goals' \| 'micros' \| 'recipes'/)
  assert.match(dashboard, /data-testid="nutrition-daily-progress-tab"/)
  assert.match(dashboard, /data-testid="nutrition-trends-tab"/)
  assert.match(dashboard, /data-testid="nutrition-goals-assessment-tab"/)
  assert.match(dashboard, /className="tier-tab-list nutrition-panel-tabs"/)
  assert.match(dashboard, /className="tier-tab-list nutrition-management-tabs"/)
})

test('nutrition dashboard reuses existing nutrition data and logging components', () => {
  assert.match(dashboard, /NutritionFoodLogger/)
  assert.match(dashboard, /fetch\('\/api\/nutrition\/add-water'/)
  assert.match(dashboard, /fetch\('\/api\/nutrition\/add-macros'/)
  assert.match(dashboard, /nutrition_log_remaining/)
  assert.match(dashboard, /logic\.trends\.filter/)
  assert.doesNotMatch(dashboard, /Math\.random|placeholder/i)
})
