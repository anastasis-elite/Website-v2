// marketing/hooks/identity.ts

export const identityHooks = {
  category: 'Identity',

  purpose:
    'Create identity interruptions that help women question self-blame and reconnect with the woman they believe they have lost.',

  rule:
    'Identity hooks should make a woman feel seen before they make her feel challenged.',

  oldBeliefs: [
    'I am broken.',
    'I have lost myself.',
    'I need to become someone different.',
    'My worth comes from productivity.',
    'Rest means I am falling behind.',
    'I keep failing.',
  ],

  newBeliefs: [
    'I am adaptive.',
    'The woman I miss is still there.',
    'I am returning to myself.',
    'My worth is not my capacity.',
    'Recovery restores who I am becoming.',
    'My system needs support, not shame.',
  ],

  hooks: [
    {
      type: 'Challenge a Belief',
      examples: [
        'I do not think you have lost yourself.',
        'The woman you miss is not gone.',
        'You are not becoming someone new.',
        'You do not need fixing.',
        'I do not think you are failing.',
        'Your capacity is not your worth.',
      ],
    },
    {
      type: 'Name the Invisible',
      examples: [
        'You miss the woman you used to be, but she is not actually gone.',
        'You have been carrying responsibilities your body was never taught to recover from.',
        'You are grieving a version of yourself that is still alive.',
        'You are not tired because you are weak.',
        'You have been disappearing inside a life everyone else depends on.',
        'You have become so good at surviving that living feels unfamiliar.',
      ],
    },
    {
      type: 'Introduce a New Mental Model',
      examples: [
        'Identity is not lost. It gets buried under survival.',
        'You are not broken. You are adaptive.',
        'The problem is not who you are. It is what your system has been adapting to.',
        'You cannot shame yourself back into the woman you miss.',
        'Your body has been protecting you, not betraying you.',
        'Self-trust is rebuilt through evidence, not criticism.',
      ],
    },
    {
      type: 'Create an Open Loop',
      examples: [
        'Everything changed when I stopped trying to become someone new.',
        'There is one reason so many women feel like strangers in their own bodies.',
        'I think we have misunderstood what it means to lose yourself.',
        'The answer was not more discipline.',
        'This is why returning to yourself feels so emotional.',
        'There is a difference between being lost and being buried.',
      ],
    },
    {
      type: 'Reverse Conventional Wisdom',
      examples: [
        'You do not need to reinvent yourself.',
        'Becoming her again might require less force, not more.',
        'The strongest women I know are not the ones who never need rest.',
        'Your old self is not the goal. Your restored self is.',
        'You may not need a new identity. You may need more capacity.',
        'You do not build self-trust by ignoring your body.',
      ],
    },
  ],

  strongestHooks: [
    'The woman you miss is not gone.',
    'You are not broken. You are adaptive.',
    'You cannot shame yourself back into the woman you miss.',
    'There is a difference between being lost and being buried.',
    'You have been disappearing inside a life everyone else depends on.',
    'Your capacity is not your worth.',
    'You do not need fixing. You need understanding.',
    'Self-trust is rebuilt through evidence, not criticism.',
  ],

  avoid: [
    'Anything that implies she is weak.',
    'Anything that frames her as broken.',
    'Anything that pressures her to become someone else.',
    'Anything that uses shame as urgency.',
    'Anything that sounds like generic self-love content.',
  ],
} as const
