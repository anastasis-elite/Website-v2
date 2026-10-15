import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'

const { foodEntryHref, mealEntryHref, inferMealType, WATER_ENTRY_HREF } = await importTs('lib/nutrition/loggingRoutes.ts')
const { getActionRouteForEvent } = await importTs('lib/schedule/engine.ts')
const { getStreakRequirementDestinations } = await importTs('lib/dashboard/logic/streakRequirementDestinations.ts')

// Exercise real route builders, including persisted action routes from the older UI.
test('daily logging routes preserve tier restrictions and open the intended entry directly', () => {
  for (const program of ['ember', 'EMBER', null, 'unknown']) {
    assert.equal(foodEntryHref(program), '/dashboard/nutrition')
    assert.equal(mealEntryHref(program, 'lunch'), '/dashboard/nutrition')
  }
  for (const program of ['ignite', 'phoenix', 'IGNITE']) {
    assert.equal(foodEntryHref(program), '/dashboard/nutrition?log=food')
    assert.equal(mealEntryHref(program, 'lunch'), '/dashboard/nutrition?log=meal&meal=lunch')
  }
  assert.equal(WATER_ENTRY_HREF, '/dashboard/nutrition?log=water')
  assert.equal(mealEntryHref('phoenix', 'dinner', 'rice & beans'), '/dashboard/nutrition?log=meal&meal=dinner&recipe=rice+%26+beans')
})

test('scheduled meals retain their available meal context and old saved routes open entry panels', () => {
  const event = { id: 'qa', title: 'Lunch and hydration', event_type: 'meal', action_route: '/dashboard/nutrition#aos-food-logger' }
  assert.equal(getActionRouteForEvent(event, 'ignite'), '/dashboard/nutrition?log=meal&meal=lunch')
  assert.equal(getActionRouteForEvent(event, 'phoenix'), '/dashboard/nutrition?log=meal&meal=lunch')
  assert.equal(getActionRouteForEvent(event, 'ember'), '/dashboard/nutrition')
  assert.equal(getActionRouteForEvent({ ...event, title: 'Food', action_route: '/dashboard/nutrition?log=meal&meal=snack&recipe=bowl' }, 'phoenix'), '/dashboard/nutrition?log=meal&meal=snack&recipe=bowl')
  assert.equal(getActionRouteForEvent({ ...event, event_type: 'hydration', action_route: '/dashboard/nutrition#hydration' }, 'ember'), WATER_ENTRY_HREF)
  assert.equal(getActionRouteForEvent({ ...event, calendar_event_id: 'personal-calendar-id' }, 'ignite'), '/dashboard/schedule#calendar-event-personal-calendar-id')
  assert.equal(getActionRouteForEvent({ ...event, action_route: '/dashboard/day/midday' }, 'ignite'), '/dashboard/day/midday')
})

test('meal context inference and progress requirement actions route without granting meal access', () => {
  assert.equal(inferMealType('Simple BREAKFAST'), 'breakfast')
  assert.equal(inferMealType('Eat dinner'), 'dinner')
  assert.equal(inferMealType('Afternoon snack'), 'snack')
  assert.equal(inferMealType('Food'), undefined)
  assert.equal(inferMealType(null), undefined)
  for (const tier of ['ember', 'ignite', 'phoenix']) {
    const actions = getStreakRequirementDestinations(tier)
    assert.equal(actions.hydration.href, WATER_ENTRY_HREF)
    assert.equal(actions.nutrition.href, mealEntryHref(tier))
  }
})
