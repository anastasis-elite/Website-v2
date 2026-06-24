import { BeliefChallenge } from './types'

export const beliefChallengeLibrary: BeliefChallenge[] = [
  {
    id: 'belief_001',
    belief: 'i_am_inconsistent',

    text:
      'You have completed actions repeatedly over the past several days. The evidence suggests you are more consistent than your self-talk currently allows you to recognize.',

    tags: ['consistency', 'evidence'],

    priority: 5,
  },

  {
    id: 'belief_002',
    belief: 'i_am_failing',

    text:
      'Progress does not require perfection. The fact that you continue returning to the process is evidence that you are still moving forward.',

    tags: ['evidence', 'progress'],

    priority: 5,
  },

  {
    id: 'belief_003',
    belief: 'i_should_be_doing_more',

    text:
      'More is not always better. The goal is building something sustainable enough to last.',

    tags: ['capacity', 'recovery'],

    priority: 5,
  },
]
