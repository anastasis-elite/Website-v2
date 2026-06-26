// marketing/hooks/emotional.ts

export const emotionalHooks = {
  category: 'Emotional',

  purpose:
    'Create emotional recognition without exploiting pain. Emotional hooks should help women feel seen, understood, and safe enough to consider a new belief.',

  rule:
    'Emotional hooks name what she feels without intensifying shame, panic, or urgency.',

  emotionsToCreate: [
    'Relief',
    'Hope',
    'Recognition',
    'Softness',
    'Self-compassion',
    'Possibility',
  ],

  emotionsToAvoid: [
    'Panic',
    'Fear',
    'Shame',
    'Guilt',
    'Desperation',
    'Inadequacy',
  ],

  hooks: [
    {
      type: 'Name the Ache',
      examples: [
        'You miss yourself, but you do not need to become someone new.',
        'There is a quiet grief that comes from not recognizing yourself anymore.',
        'You are not dramatic for wanting your life to feel lighter.',
        'Sometimes the hardest part is realizing how long you have been surviving.',
        'You can love your life and still feel exhausted by carrying it.',
        'There is a version of you that still remembers what peace feels like.',
      ],
    },
    {
      type: 'Create Relief',
      examples: [
        'Nothing about you is broken.',
        'You are not failing. You are overloaded.',
        'Your exhaustion makes sense.',
        'Your body has been trying to protect you, not punish you.',
        'You do not need more shame. You need more capacity.',
        'This is not a character flaw. It is a capacity signal.',
      ],
    },
    {
      type: 'Mirror Her Reality',
      examples: [
        'You are the one everyone depends on, but no one sees what it costs you.',
        'You keep showing up, even when you feel like you are disappearing.',
        'You have become so good at holding everything together that people forget you need holding too.',
        'You are not tired from doing nothing. You are tired from carrying everything.',
        'Your body knows the weight of responsibilities your calendar makes look normal.',
        'You have been functioning, but functioning is not the same as thriving.',
      ],
    },
    {
      type: 'Open Hope',
      examples: [
        'The woman you miss is still there.',
        'You can feel like yourself again.',
        'Your life can feel spacious again.',
        'Capacity can be rebuilt.',
        'Peace can become familiar again.',
        'You are allowed to build a life that does not require losing yourself.',
      ],
    },
    {
      type: 'Gentle Challenge',
      examples: [
        'What if the problem was never your discipline?',
        'What if your body has been communicating instead of failing?',
        'What if rest is not the thing keeping you behind?',
        'What if you have been blaming yourself for a system problem?',
        'What if the woman you miss has only been buried under survival?',
        'What if health is supposed to give you your life back?',
      ],
    },
  ],

  strongestHooks: [
    'You can love your life and still feel exhausted by carrying it.',
    'There is a quiet grief that comes from not recognizing yourself anymore.',
    'You are not tired from doing nothing. You are tired from carrying everything.',
    'You have been functioning, but functioning is not the same as thriving.',
    'Your body has been trying to protect you, not punish you.',
    'The woman you miss is still there.',
    'You are allowed to build a life that does not require losing yourself.',
    'This is not a character flaw. It is a capacity signal.',
  ],

  avoid: [
    'Do not dramatize her pain.',
    'Do not use trauma as a hook.',
    'Do not imply she is helpless.',
    'Do not make motherhood sound like a burden she should escape.',
    'Do not use guilt to motivate action.',
    'Do not make her feel behind.',
  ],
} as const
