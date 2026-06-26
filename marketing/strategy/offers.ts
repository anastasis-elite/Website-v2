// marketing/strategy/offers.ts

export const offers = {
  philosophy:
    'Women do not purchase fitness. They progress through increasing levels of understanding, capacity, and Human Engineering.',

  journey: [
    {
      level: 1,
      stage: 'Discover',

      purpose:
        'Help women realize they do not have a discipline problem.',

      transformation:
        'I am not broken.',

      products: [
        'Capacity Audit',
        'Capacity Score',
        'Educational content',
        'Newsletter',
        'Daily Insights',
        'The Capacity Project',
      ],
    },

    {
      level: 2,
      stage: 'Understand',

      purpose:
        'Introduce the foundations of Adaptive Human Engineering.',

      transformation:
        'I finally understand why nothing else worked.',

      products: [
        'The Anastasis Shift',
        'Capacity Blueprint',
        'Human Engineering Foundations',
        'Recovery Foundations',
        'Nervous System Foundations',
      ],
    },

    {
      level: 3,
      stage: 'Build',

      program: 'EMBER',

      purpose:
        'Build foundational capacity.',

      transformation:
        'I trust myself again.',

      focus: [
        'Movement',
        'Nutrition',
        'Recovery',
        'Adaptive Programming',
      ],
    },

    {
      level: 4,
      stage: 'Optimize',

      program: 'IGNITE',

      purpose:
        'Optimize the entire system.',

      transformation:
        'I have rebuilt my capacity.',

      focus: [
        'Nutrition Optimization',
        'Micronutrients',
        'Adaptive Intelligence',
        'Progress Tracking',
        'Daily Coaching Insights',
      ],
    },

    {
      level: 5,
      stage: 'Engineer',

      program: 'PHOENIX',

      purpose:
        'Full Adaptive Human Engineering.',

      transformation:
        'I understand how to work with my body instead of against it.',

      focus: [
        'Fitness',
        'Nutrition',
        'Recovery',
        'Hormones',
        'Lifestyle',
        'Stress',
        'Environment',
        'Adaptive Intelligence',
        'Education',
      ],
    },

    {
      level: 6,
      stage: 'Master',

      future: true,

      program: 'Human Engineering Academy',

      purpose:
        'Teach women to become Human Engineers.',

      transformation:
        'I can now engineer my own health and help others do the same.',

      curriculum: [
        'Human Biology',
        'Human Mechanics',
        'Recovery Engineering',
        'Behavioral Systems',
        'Adaptive Programming',
        'Capacity Science',
        'Systems Thinking',
        'Women’s Physiology',
        'Environment Design',
        'Decision Architecture',
      ],
    },

    {
      level: 7,
      stage: 'Leadership',

      future: true,

      purpose:
        'Equip Human Engineers to influence others.',

      transformation:
        'I help others build lives where thriving becomes more attainable.',

      pathways: [
        'Coach',
        'Consultant',
        'Healthcare Professional',
        'Business Leader',
        'Parent',
        'Educator',
      ],
    },
  ],

  educationalJourney: [
    'I do not know what is wrong.',
    'I understand myself.',
    'I can consistently care for myself.',
    'I understand how humans work.',
    'I can engineer my own life.',
    'I can teach others.',
  ],

  progression:
    'Every offer exists to move a woman toward greater understanding, greater capacity, and greater autonomy.',

  ultimateGoal:
    'Our goal is not lifelong dependence. Our goal is to help women become Human Engineers who confidently navigate every season of life.',

  roadmap: {
    current: [
      'Capacity Audit',
      'The Anastasis Shift',
      'EMBER',
      'IGNITE',
      'PHOENIX',
    ],

    future: [
      'Human Engineering Academy',
      'Certified Human Engineer',
    ],
  },
} as const
