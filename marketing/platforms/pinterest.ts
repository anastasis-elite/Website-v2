// marketing/platforms/pinterest.ts

export const pinterestPlatform = {
  name: 'Pinterest',

  role:
    'Evergreen discovery, search, and visual education platform for Anastasis. Pinterest is where women find capacity-based wellness ideas through saved visuals, searchable concepts, and aspirational-but-grounded lifestyle content.',

  primaryObjective:
    'Turn Anastasis concepts into searchable, saveable, evergreen visual assets that help women discover Human Engineering, capacity, recovery, and adaptive wellness over time.',

  audienceState:
    'Searching, planning, saving, and imagining. She may be looking for wellness routines, mom health support, nervous system regulation, strength training, nutrition, burnout recovery, or lifestyle inspiration.',

  bestFor: [
    'Evergreen education',
    'Infographics',
    'Carousel-style pins',
    'Blog traffic',
    'Capacity Audit traffic',
    'The Anastasis Shift traffic',
    'Lifestyle inspiration',
    'Recovery education',
    'Nutrition education',
    'Women’s wellness search discovery',
  ],

  strongestFormats: [
    'Static quote pins',
    'Educational infographic pins',
    'Checklist pins',
    'Carousel pins',
    'Idea pins',
    'Blog post pins',
    'Dashboard feature pins',
    'Before-and-after thinking pins',
    'Capacity framework pins',
    'Lifestyle vision pins',
  ],

  pillarPriority: [
    'Education',
    'Evidence',
    'Lifestyle',
    'Identity',
    'Philosophy',
    'Invitation',
  ],

  strongestHookFamilies: [
    'Curiosity',
    'Authority',
    'Identity',
    'Contrarian',
    'Why Now',
    'Story',
  ],

  pinStrategy: {
    visualStyle:
      'Minimal, refined, calm, elegant, and clear. Pinterest should feel premium and peaceful, not loud or cluttered.',

    textStyle:
      'Short, searchable, and belief-shifting. Use language women would save because it helps them understand themselves.',

    bestTextLength:
      '3-9 words on the pin image. Longer explanation belongs in the title, description, or linked content.',
  },

  pinTextExamples: [
    'You are not lazy.',
    'Capacity changes everything.',
    'Recovery is productive.',
    'Health should feel lighter.',
    'Your body is communicating.',
    'Progress leaves clues.',
    'Systems beat willpower.',
    'Return to yourself.',
    'Strong women recover.',
    'Build a life, not just a body.',
  ],

  boardIdeas: [
    'Adaptive Women’s Wellness',
    'Human Engineering',
    'Capacity-Based Fitness',
    'Recovery for High-Capacity Women',
    'Strength Training for Women',
    'Nervous System Regulation',
    'Nutrition Strategy',
    'Motherhood and Capacity',
    'Women’s Wellness Education',
    'Returning to Yourself',
    'Health as Freedom',
    'Anastasis',
  ],

  seoKeywords: [
    'women’s wellness',
    'fitness for busy moms',
    'burnout recovery for women',
    'nervous system regulation',
    'strength training for women',
    'healthy lifestyle for moms',
    'recovery routines',
    'self trust',
    'women’s health education',
    'capacity building',
    'adaptive wellness',
    'holistic women’s wellness',
    'nutrition strategy',
    'stress recovery',
    'mom wellness',
  ],

  contentStructure: [
    {
      format: 'Static Pin',
      structure: [
        'Belief-shifting headline',
        'Calm visual',
        'Searchable title',
        'Description with context',
        'Link to next step',
      ],
    },
    {
      format: 'Infographic Pin',
      structure: [
        'Problem or belief',
        'Human Engineering explanation',
        'Simple framework',
        'Evidence or examples',
        'Soft invitation',
      ],
    },
    {
      format: 'Blog Pin',
      structure: [
        'Searchable problem',
        'Clear promise',
        'Visual branded graphic',
        'Link to article, audit, or guide',
      ],
    },
  ],

  titleGuidelines: {
    purpose:
      'Pinterest titles should balance searchability with Anastasis language.',

    examples: [
      'Why You Do Not Have a Discipline Problem',
      'How to Build Capacity Without Burning Out',
      'Recovery Is Productive for Women’s Health',
      'Signs Your Body Is Asking for Recovery',
      'Capacity-Based Wellness for Busy Moms',
      'How to Return to Yourself Through Health',
      'Strength Training as Nervous System Support',
      'Why Health Should Support Your Life',
    ],
  },

  descriptionGuidelines: {
    purpose:
      'Descriptions should explain the concept, include searchable language naturally, and invite the next step without pressure.',

    ctaExamples: [
      'Take the Capacity Audit.',
      'Read The Anastasis Shift.',
      'Start understanding your capacity.',
      'Explore Human Engineering for women.',
      'Save this for the day you start blaming yourself again.',
    ],
  },

  analyticsToWatch: [
    'Impressions',
    'Saves',
    'Outbound clicks',
    'Pin clicks',
    'Board follows',
    'Search terms',
    'Top performing pins',
    'Traffic to audit',
    'Traffic to blog',
    'Traffic to guide',
  ],

  interpretation: {
    highImpressionsLowSaves:
      'The keyword or visual may be discoverable, but the concept may not feel saveable enough.',

    highSavesLowClicks:
      'The pin created value or identity resonance, but the invitation may need to be clearer.',

    highClicks:
      'The topic has strong intent and should become a blog, carousel, email, or YouTube topic.',

    highBoardFollows:
      'The category is building long-term interest and should receive more evergreen content.',
  },

  postingStrategy: {
    cadence:
      '5-15 pins per week when capacity allows. Repurpose carousels, blog posts, quotes, lessons, and dashboard concepts into evergreen pins.',

    weeklyMix: [
      '2-4 educational pins',
      '2 identity or philosophy quote pins',
      '1-3 lifestyle pins',
      '1-2 evidence/progress pins',
      '1-2 invitation pins linking to audit, guide, or blog',
    ],
  },

  contentRules: [
    'Pinterest should prioritize evergreen clarity over trends.',
    'Every pin should be searchable, saveable, or clickable.',
    'Use calm visuals and refined typography.',
    'Avoid cluttered graphics.',
    'Do not use shame-based body language.',
    'Do not make weight loss the primary promise.',
    'Use Pinterest as a long-term traffic engine for the audit, guide, blog, and YouTube.',
  ],

  successDefinition:
    'Pinterest succeeds when Anastasis concepts become discoverable and saveable, steadily bringing women into the ecosystem through search, visual education, and long-term capacity-based wellness content.',
} as const
