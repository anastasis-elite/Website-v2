import { Observation } from './types'

export const observationLibrary: Observation[] = [
  {
    id: 'hydration_streak_001',
    category: 'hydration',
    text:
      'You completed hydration consistently enough for it to become visible evidence.',
    tags: ['evidence', 'consistency', 'hydration'],
    minCompletions: 3,
    priority: 2,
  },

  {
    id: 'movement_stress_001',
    category: 'movement',
    text:
      'You completed movement even while carrying more stress than usual.',
    tags: ['movement', 'resilience', 'evidence'],
    capacity: ['low', 'medium'],
    minCompletions: 1,
    priority: 3,
  },

  {
    id: 'nutrition_anchor_001',
    category: 'nutrition',
    text:
      'You gave your body nourishment instead of waiting for the perfect day to start again.',
    tags: ['nutrition', 'consistency'],
    minCompletions: 1,
    priority: 2,
  },

  {
    id: 'recovery_low_capacity_001',
    category: 'recovery',
    text:
      'You chose recovery when your capacity was lower, which means you are learning to respond instead of force.',
    tags: ['recovery', 'capacity', 'self-awareness'],
    capacity: ['low'],
    minCompletions: 1,
    priority: 4,
  },

  {
    id: 'reflection_001',
    category: 'reflection',
    text:
      'You paused long enough to notice what is actually happening inside your body and life.',
    tags: ['reflection', 'awareness'],
    minCompletions: 1,
    priority: 2,
  },

  {
    id: 'consistency_001',
    category: 'consistency',
    text:
      'You have created more consistency than your self-talk may be giving you credit for.',
    tags: ['consistency', 'evidence', 'self-trust'],
    minCompletions: 3,
    priority: 3,
  },

  {
    id: 'momentum_001',
    category: 'momentum',
    text:
      'Momentum is starting to show up through repeated action, not perfect execution.',
    tags: ['momentum', 'evidence'],
    minCompletions: 3,
    priority: 3,
  },

  {
    id: 'menstrual_capacity_001',
    category: 'cycle',
    text:
      'Your energy may be lower in this phase, but the data shows you have not abandoned yourself.',
    tags: ['cycle', 'menstrual', 'evidence'],
    cyclePhase: ['menstrual'],
    capacity: ['low', 'medium'],
    priority: 4,
  },
]
