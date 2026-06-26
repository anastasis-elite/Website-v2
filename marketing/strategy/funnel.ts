// marketing/strategy/funnel.ts

export const funnel = {
  philosophy:
    'Traditional marketing funnels optimize for conversion. The Anastasis Marketing Funnel optimizes for belief transformation.',

  coreIdea:
    'Marketing does not move people through products. It moves them through beliefs.',

  transformationArc: [
    'Broken',
    'Seen',
    'Understood',
    'Relieved',
    'Hopeful',
    'Committed',
    'Capable',
    'Confident',
    'Autonomous',
    'Leader',
  ],

  stages: [
    {
      stage: 1,
      name: 'Unseen',
      currentBelief: 'Something is wrong with me.',
      emotionalState: [
        'Burned out',
        'Guilty',
        'Overwhelmed',
        'Invisible',
        'Disconnected',
      ],
      message: 'You are not broken.',
      objective:
        'Interrupt self-blame and create the first crack in the old belief system.',
      sellingMode: 'None',
    },

    {
      stage: 2,
      name: 'Seen',
      currentBelief:
        'Wait… that is exactly how I feel.',
      emotionalState: [
        'Recognized',
        'Emotional',
        'Curious',
        'Cautiously open',
      ],
      message:
        'Your experience makes sense.',
      objective:
        'Create resonance through accurate articulation of her lived experience.',
      sellingMode: 'No selling. Only understanding.',
    },

    {
      stage: 3,
      name: 'Understanding',
      currentBelief:
        'Maybe there is actually a reason this is happening.',
      emotionalState: [
        'Curious',
        'Validated',
        'Mentally engaged',
      ],
      topics: [
        'Nervous system',
        'Capacity',
        'Recovery',
        'Hormones',
        'Environment',
        'Stress',
        'Adaptive systems',
      ],
      message:
        'Your body and life are operating as a system.',
      objective:
        'Introduce Human Engineering and explain why her struggle has context.',
      sellingMode: 'Education',
    },

    {
      stage: 4,
      name: 'Relief',
      currentBelief:
        'I am not failing.',
      emotionalState: [
        'Relieved',
        'Less ashamed',
        'Softened',
        'Hopeful',
      ],
      message:
        'You do not have a discipline problem. You have a capacity problem.',
      objective:
        'Remove shame and reframe the problem from personal failure to system overload.',
      sellingMode: 'Trust building',
    },

    {
      stage: 5,
      name: 'Hope',
      currentBelief:
        'Maybe I can rebuild.',
      emotionalState: [
        'Hopeful',
        'Open',
        'Interested',
        'Ready to learn more',
      ],
      message:
        'Capacity can be restored.',
      objective:
        'Move her from relief into possibility.',
      offers: [
        'Capacity Audit',
        'Anastasis Shift',
        'Newsletter',
        'Email',
        'The Capacity Project',
      ],
      sellingMode: 'Low-friction invitation',
    },

    {
      stage: 6,
      name: 'Decision',
      currentBelief:
        'Is Anastasis for me?',
      emotionalState: [
        'Considering',
        'Comparing',
        'Evaluating trust',
        'Looking for fit',
      ],
      message:
        'This is not another program. This is a system that adapts to you.',
      objective:
        'Help her choose the right level of support.',
      offers: [
        'EMBER',
        'IGNITE',
        'PHOENIX',
      ],
      sellingMode: 'Clear invitation',
    },

    {
      stage: 7,
      name: 'Transformation',
      currentBelief:
        'I am collecting evidence that I can trust myself again.',
      emotionalState: [
        'Encouraged',
        'Capable',
        'Increasingly confident',
      ],
      evidence: [
        'I slept.',
        'I laughed.',
        'I had patience.',
        'I enjoyed my kids.',
        'I trusted my body.',
        'I moved with confidence.',
        'I recovered.',
        'I showed up.',
      ],
      message:
        'Every piece of evidence rebuilds identity.',
      objective:
        'Help her recognize progress beyond weight loss.',
      sellingMode: 'Client experience',
    },

    {
      stage: 8,
      name: 'Autonomy',
      currentBelief:
        'I understand myself and can adapt.',
      emotionalState: [
        'Confident',
        'Self-trusting',
        'Grounded',
        'Capable',
      ],
      message:
        'The highest form of coaching creates autonomy.',
      objective:
        'Teach her to navigate every season of life with wisdom, resilience, and self-trust.',
      sellingMode: 'Education and mastery',
    },

    {
      stage: 9,
      name: 'Movement',
      currentBelief:
        'Human Engineering changes how people live.',
      emotionalState: [
        'Convicted',
        'Leadership-oriented',
        'Mission-aligned',
      ],
      message:
        'Thriving spreads through people who understand how humans work.',
      objective:
        'Turn transformation into lived philosophy, advocacy, teaching, and eventually certification.',
      futurePathways: [
        'Certified Human Engineers',
        'Coaches',
        'Consultants',
        'Parents',
        'Teachers',
        'Healthcare providers',
        'Business leaders',
      ],
      sellingMode: 'Movement building',
    },
  ],

  contentRules: [
    'Do not rush the sale before belief has shifted.',
    'Resonance comes before conversion.',
    'Understanding comes before invitation.',
    'Relief comes before commitment.',
    'Evidence comes before identity change.',
    'Autonomy is the highest outcome.',
    'The sale happens because her worldview changes, not because she was pressured.',
  ],
} as const
