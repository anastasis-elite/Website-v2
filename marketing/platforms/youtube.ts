// marketing/platforms/youtube.ts

export const youtubePlatform = {
  name: 'YouTube',

  role:
    'Depth, authority, and long-form education platform for Anastasis. YouTube is where Human Engineering becomes fully explained, documented, and trusted over time.',

  primaryObjective:
    'Turn curiosity into deep understanding by teaching the Anastasis philosophy, Human Engineering framework, and capacity-based wellness model through long-form and searchable content.',

  audienceState:
    'Warm, searching, or deep-processing. She may be actively looking for answers around burnout, women’s health, strength training, recovery, hormones, capacity, or rebuilding herself.',

  bestFor: [
    'Long-form education',
    'The Capacity Project',
    'Founder philosophy',
    'Human Engineering lessons',
    'Searchable evergreen content',
    'Program explanations',
    'Dashboard walkthroughs',
    'Client education',
    'Authority building',
  ],

  contentTypes: {
    shorts: '7-60 seconds',
    standardVideos: '6-15 minutes',
    deepDives: '20-45 minutes',
    capacityProject: '30-60 minutes',
  },

  contentStructure: [
    {
      step: 1,
      name: 'Belief Interruption',
      purpose:
        'Open with the belief being challenged or the problem being reframed.',
    },
    {
      step: 2,
      name: 'Context',
      purpose:
        'Name the experience women are having and why it matters.',
    },
    {
      step: 3,
      name: 'Framework',
      purpose:
        'Teach the Human Engineering principle behind the issue.',
    },
    {
      step: 4,
      name: 'Application',
      purpose:
        'Show how this applies to real life, training, nutrition, recovery, or identity.',
    },
    {
      step: 5,
      name: 'Evidence',
      purpose:
        'Show what progress looks like beyond the obvious metrics.',
    },
    {
      step: 6,
      name: 'Invitation',
      purpose:
        'Offer the next step with clarity and no pressure.',
    },
  ],

  strongestFormats: [
    'The Capacity Project episodes',
    'Human Engineering deep dives',
    'Founder monologues',
    'Whiteboard lessons',
    'Dashboard walkthroughs',
    'Program explainers',
    'Recovery education',
    'Women’s physiology education',
    'Strength and posture education',
    'Shorts repurposed from TikTok/Reels',
  ],

  pillarPriority: [
    'Education',
    'Philosophy',
    'Authority',
    'Evidence',
    'Identity',
    'Invitation',
    'Lifestyle',
  ],

  strongestHookFamilies: [
    'Authority',
    'Contrarian',
    'Curiosity',
    'Story',
    'Identity',
    'Why Now',
  ],

  titleGuidelines: {
    purpose:
      'Titles should be searchable and belief-shifting without becoming clickbait.',

    examples: [
      'You Do Not Have a Discipline Problem',
      'Why Recovery Is Productive',
      'The Capacity Problem Most Women Miss',
      'Why Health Should Give You Your Life Back',
      'The Fitness Industry Is Solving the Wrong Problem',
      'How to Rebuild Capacity Without Burning Out',
      'What Human Engineering Means for Women’s Health',
      'Why Your Body Is Not Failing You',
    ],
  },

  thumbnailGuidelines: {
    purpose:
      'Thumbnails should communicate the core belief shift visually and simply.',

    textExamples: [
      'Not Discipline. Capacity.',
      'You Are Not Broken.',
      'Recovery Is Productive.',
      'Health Should Feel Lighter.',
      'The Wrong Question.',
      'Capacity Changes Everything.',
    ],
  },

  descriptionGuidelines: {
    purpose:
      'Descriptions should summarize the belief shift, give searchable context, and guide viewers to the next step.',

    ctaExamples: [
      'Take the Capacity Audit.',
      'Read The Anastasis Shift.',
      'Start understanding your capacity.',
      'Explore Anastasis.',
      'Subscribe for Human Engineering lessons for women.',
    ],
  },

  shortsStrategy: {
    role:
      'YouTube Shorts should repurpose the clearest TikTok and Instagram belief interruptions into searchable discovery content.',

    bestUses: [
      'Contrarian hooks',
      'Identity hooks',
      'Capacity reframes',
      'Recovery reframes',
      'Short story moments',
      'Dashboard clips',
      'Quick lessons',
    ],
  },

  longFormStrategy: {
    role:
      'Long-form YouTube should become the public library of Anastasis thought leadership.',

    bestUses: [
      'Explain the philosophy behind Anastasis.',
      'Teach the Human Engineering framework.',
      'Break down capacity, recovery, and adaptation.',
      'Create evergreen education for women searching for answers.',
      'Build trust before deeper offers.',
    ],
  },

  analyticsToWatch: [
    'Click-through rate',
    'Average view duration',
    'Retention at 30 seconds',
    'Retention at 50%',
    'Comments',
    'Shares',
    'Saves/Add to playlist',
    'Subscribers gained',
    'Traffic source',
    'Search terms',
    'Link clicks',
  ],

  interpretation: {
    highCtrLowRetention:
      'The title or thumbnail created curiosity, but the video may not have delivered clarity quickly enough.',

    lowCtrHighRetention:
      'The content is valuable, but the title or thumbnail needs a clearer belief interruption.',

    highSearchTraffic:
      'The topic is evergreen and should become part of the educational library.',

    highComments:
      'The content created resonance, understanding, or thoughtful discussion.',

    highSubscribers:
      'The video made viewers want more of the Anastasis worldview.',
  },

  postingStrategy: {
    cadence:
      'Minimum: 1 long-form video per week or 1 Capacity Project episode per week. Shorts can be posted 3-7 times per week from repurposed TikTok/Reels content.',

    weeklyMix: [
      '1 long-form education, philosophy, or Capacity Project video',
      '3-7 Shorts from strongest short-form content',
      '1 program, audit, or dashboard explanation when needed',
    ],
  },

  contentRules: [
    'YouTube should prioritize depth over speed.',
    'Do not use panic-based titles.',
    'Make every video searchable through clear topic language.',
    'Teach frameworks, not random tips.',
    'Use Shorts as discovery, long-form as trust.',
    'Every long-form video should strengthen the Human Engineering library.',
    'Do not overproduce before the message is clear.',
  ],

  successDefinition:
    'YouTube succeeds when it becomes the searchable library where women move from curiosity to deep trust in Anastasis, Human Engineering, and the capacity-based approach to health.',
} as const
