// marketing/platforms/tiktok.ts

export const tiktokPlatform = {
  name: 'TikTok',

  role:
    'Primary discovery platform for Anastasis. TikTok is where new women first encounter the philosophy, feel seen, and begin questioning the beliefs that have kept them blaming themselves.',

  primaryObjective:
    'Create belief interruption, emotional resonance, and curiosity that moves women from unseen to seen, then toward deeper understanding.',

  audienceState:
    'Mostly cold or lightly warm. She may not know Anastasis yet, but she recognizes the feeling of burnout, responsibility, self-loss, and exhaustion.',

  bestFor: [
    'Identity interruption',
    'Emotional resonance',
    'Contrarian philosophy',
    'Founder story',
    'Human Engineering education',
    'Capacity-based reframes',
    'Lifestyle proof',
  ],

  contentLength: {
    short: '7-15 seconds',
    standard: '20-45 seconds',
    long: '60-90 seconds',
    note:
      'Use short content for sharp belief interruptions. Use longer content when explaining Human Engineering, recovery, capacity, or identity shifts.',
  },

  hookTiming:
    'The first 1-2 seconds must create recognition, contradiction, or curiosity.',

  contentStructure: [
    {
      step: 1,
      name: 'Hook',
      purpose:
        'Interrupt an old belief or name an invisible experience.',
    },
    {
      step: 2,
      name: 'Context',
      purpose:
        'Explain what she has been experiencing.',
    },
    {
      step: 3,
      name: 'Reframe',
      purpose:
        'Replace shame with Human Engineering understanding.',
    },
    {
      step: 4,
      name: 'Evidence or Example',
      purpose:
        'Make the reframe feel real and applicable.',
    },
    {
      step: 5,
      name: 'Invitation',
      purpose:
        'Offer the next step without pressure.',
    },
  ],

  winningFormats: [
    'Talking head',
    'Voiceover over gym footage',
    'Voiceover over dashboard footage',
    'Car reflections',
    'Mirror reflections',
    'Founder story',
    'Green screen comment reply',
    'Text-on-screen belief interruption',
    'Day-in-the-life with Human Engineering lens',
    'Mini lesson',
  ],

  pillarPriority: [
    'Identity',
    'Philosophy',
    'Evidence',
    'Education',
    'Lifestyle',
    'Invitation',
  ],

  strongestHookFamilies: [
    'Identity',
    'Emotional',
    'Contrarian',
    'Authority',
    'Story',
    'Why Now',
  ],

  contentRules: [
    'Do not chase trends if they dilute the message.',
    'Do not create panic for retention.',
    'Do not use shame as urgency.',
    'Do not over-explain in the first sentence.',
    'Make the first line emotionally or philosophically clear.',
    'Every video should move one belief.',
    'Use TikTok to create recognition before selling.',
    'Let the comment section reveal what language resonates.',
  ],

  ostGuidelines: {
    purpose:
      'OST should stop the right woman because she feels recognized, not because she feels attacked.',

    examples: [
      'You do not need more discipline.',
      'The woman you miss is still there.',
      'Your body is not failing you.',
      'You are not lazy. You are overloaded.',
      'Recovery is productive.',
      'Health should give you your life back.',
      'Consistency is not the goal.',
      'You have been solving the wrong problem.',
    ],
  },

  captionGuidelines: {
    purpose:
      'Captions should deepen the belief shift and invite the next step.',

    structure: [
      'Name the old belief.',
      'Explain the Human Engineering reframe.',
      'Give her language for her experience.',
      'Invite her into capacity, audit, education, or reflection.',
    ],

    ctaExamples: [
      'Take the Capacity Audit.',
      'Comment CAPACITY and I’ll send you the starting point.',
      'Start understanding yourself here.',
      'Begin with capacity.',
      'Save this for the day you start blaming yourself again.',
    ],
  },

  analyticsToWatch: [
    'Average watch time',
    'Retention at 2 seconds',
    'Retention at 5 seconds',
    'Shares',
    'Saves',
    'Comments from aligned women',
    'Profile views',
    'Follows per video',
    'Capacity Audit clicks',
  ],

  interpretation: {
    highViewsLowEngagement:
      'The hook created attention, but the belief shift may not have been strong enough.',

    lowViewsHighEngagement:
      'The message may be deeply aligned but needs a clearer hook or stronger opening line.',

    highSaves:
      'Education or identity content created long-term value.',

    highShares:
      'Philosophy or contrarian content articulated something women want others to understand.',

    highComments:
      'The content created recognition or emotional resonance.',

    highProfileViews:
      'The video created enough trust or curiosity for the viewer to investigate Anastasis.',
  },

  postingStrategy: {
    cadence:
      '3-5 posts per day when capacity allows. Minimum sustainable rhythm: 2 posts per day.',

    dailyMix: [
      '1 Identity or Emotional post',
      '1 Philosophy or Contrarian post',
      '1 Education or Evidence post',
      '1 Lifestyle or Story post when available',
      '1 Invitation post when actively promoting an offer',
    ],

    weeklyMix: [
      'Identity: 20-25%',
      'Philosophy: 20%',
      'Education: 20%',
      'Evidence: 15%',
      'Lifestyle: 15%',
      'Invitation: 5-10%',
    ],
  },

  platformSpecificNotes: [
    'TikTok is the testing ground for language.',
    'Strong comments matter more than vanity views.',
    'Repeat winning concepts with different hooks.',
    'Do not assume one low-performing video means the message is wrong.',
    'TikTok should feed Instagram, YouTube Shorts, email topics, and long-form Capacity Project ideas.',
  ],

  successDefinition:
    'TikTok succeeds when the right woman feels seen enough to follow, comment, share, save, visit the profile, or take the next step toward understanding her capacity.',
} as const
