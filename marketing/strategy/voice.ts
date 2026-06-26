// marketing/strategy/voice.ts

export const voice = {
  core:
    'Calm. Intelligent. Grounded. Hopeful.',

  essence:
    'We do not create urgency. We create understanding. We do not motivate through fear. We illuminate through truth. We do not overwhelm. We simplify complexity.',

  oneSentence:
    'Calm enough to regulate. Intelligent enough to teach. Compassionate enough to make women feel seen. Confident enough to challenge what no longer serves them.',

  guidingPrinciple:
    'We speak to women as intelligent, capable humans who have been misunderstood—not as problems waiting to be fixed.',

  voicePillars: [
    {
      name: 'Intelligent without arrogance',
      description:
        'We teach. We never lecture. We explain. We never talk down. We are evidence-driven and deeply human.',
      avoid:
        'You are doing it wrong.',
      use:
        'Your body is responding exactly how we would expect under chronic stress.',
    },
    {
      name: 'Compassionate without pity',
      description:
        'We never make women feel fragile. We acknowledge reality while reminding them of their capability.',
      avoid:
        'You are doing the best you can.',
      use:
        'You have been carrying more than most people realize.',
    },
    {
      name: 'Confident without ego',
      description:
        'We do not need to prove we are smart. We do not use jargon to impress. We use clarity. Confidence sounds quiet.',
    },
    {
      name: 'Elegant without being distant',
      description:
        'Luxury does not mean cold. Luxury means intentional. Every word has purpose. Nothing feels rushed. Nothing feels chaotic.',
    },
    {
      name: 'Curious instead of judgmental',
      description:
        'Our first question is always why, not what is wrong.',
    },
  ],

  communicationStyle: {
    shouldFeelLike:
      'Someone finally understands me.',
    shouldNotFeelLike:
      'Someone is trying to convince me.',
  },

  emotionalTone: {
    create: [
      'Relief',
      'Curiosity',
      'Hope',
      'Confidence',
      'Peace',
      'Empowerment',
    ],
    avoid: [
      'Panic',
      'Urgency',
      'Guilt',
      'Shame',
    ],
  },

  readingLevel:
    'Simple enough to understand. Sophisticated enough to respect intelligence. We explain complex ideas simply without oversimplifying the woman.',

  neverSoundLike: [
    'Salesy',
    'Loud',
    'Aggressive',
    'Manipulative',
    'Fear-based',
    'Shame-driven',
    'Trendy for the sake of trends',
    'Clickbait',
  ],

  alwaysSoundLike: [
    'Thoughtful',
    'Scientific',
    'Adaptive',
    'Encouraging',
    'Honest',
    'Refined',
    'Grounded',
    'Hopeful',
  ],

  communicationFormula: [
    {
      step: 1,
      name: 'Observe',
      purpose:
        'Name what she is experiencing.',
    },
    {
      step: 2,
      name: 'Explain',
      purpose:
        'Help her understand why.',
    },
    {
      step: 3,
      name: 'Reframe',
      purpose:
        'Replace self-blame with understanding.',
    },
    {
      step: 4,
      name: 'Empower',
      purpose:
        'Show her what is possible.',
    },
    {
      step: 5,
      name: 'Invite',
      purpose:
        'Offer the next step.',
    },
  ],

  example:
    'You have been told you need more discipline. But what if discipline is not the problem? When your nervous system is overloaded and your capacity is depleted, pushing harder often makes things worse. Your body is not working against you. It is adapting to the demands you have placed on it. When you restore capacity, consistency becomes something you build—not something you force.',
} as const
