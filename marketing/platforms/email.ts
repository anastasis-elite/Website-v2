// marketing/platforms/email.ts

export const emailPlatform = {
  name: 'Email',

  role:
    'Depth, trust, nurture, and conversion platform for Anastasis. Email is where women move from resonance into deeper understanding, repeated belief shifts, and clear next steps.',

  primaryObjective:
    'Nurture women through the belief transformation funnel by creating clarity, trust, education, evidence, and thoughtful invitations over time.',

  audienceState:
    'Warm. She has already given permission for deeper communication and is likely seeking more understanding, support, or a clear pathway.',

  bestFor: [
    'Nurture sequences',
    'Capacity Audit follow-up',
    'The Anastasis Shift delivery',
    'Weekly insights',
    'Founder letters',
    'Program education',
    'Client/evidence stories',
    'Offer invitations',
    'Long-form belief shifts',
  ],

  strongestFormats: [
    'Founder letters',
    'Educational emails',
    'Story-based emails',
    'Audit result follow-ups',
    'Program pathway emails',
    'Weekly Capacity Notes',
    'Launch sequences',
    'Re-engagement emails',
    'Client evidence emails',
  ],

  pillarPriority: [
    'Education',
    'Identity',
    'Evidence',
    'Philosophy',
    'Invitation',
    'Lifestyle',
  ],

  strongestHookFamilies: [
    'Story',
    'Authority',
    'Identity',
    'Emotional',
    'Contrarian',
    'Why Now',
  ],

  contentStructure: [
    {
      step: 1,
      name: 'Recognition',
      purpose:
        'Name what she is experiencing so she feels understood.',
    },
    {
      step: 2,
      name: 'Reframe',
      purpose:
        'Replace self-blame with Human Engineering understanding.',
    },
    {
      step: 3,
      name: 'Teaching',
      purpose:
        'Explain the principle behind the reframe.',
    },
    {
      step: 4,
      name: 'Application',
      purpose:
        'Show how this applies to her life today.',
    },
    {
      step: 5,
      name: 'Invitation',
      purpose:
        'Offer a next step without pressure.',
    },
  ],

  subjectLineGuidelines: {
    purpose:
      'Subject lines should create recognition, curiosity, or relief without sounding salesy or manipulative.',

    examples: [
      'You do not need more discipline',
      'Your body is not failing you',
      'The woman you miss is still there',
      'What capacity actually means',
      'This counts as progress',
      'A different way to think about recovery',
      'You are not starting over',
      'Health should give you your life back',
    ],
  },

  previewTextGuidelines: {
    purpose:
      'Preview text should deepen the hook and make the email feel personally relevant.',

    examples: [
      'What if the problem was never your motivation?',
      'There may be a reason this has felt so hard.',
      'Progress often begins before it becomes visible.',
      'Your next step may be simpler than you think.',
    ],
  },

  sequenceTypes: [
    {
      name: 'Welcome Sequence',
      purpose:
        'Introduce Anastasis, Human Engineering, capacity, and the belief shift from self-blame to self-understanding.',
      recommendedLength: '5-7 emails',
    },
    {
      name: 'Capacity Audit Sequence',
      purpose:
        'Help women understand their score, interpret their current capacity, and choose the next appropriate step.',
      recommendedLength: '3-5 emails',
    },
    {
      name: 'Anastasis Shift Sequence',
      purpose:
        'Deliver low-ticket education and deepen the Human Engineering framework.',
      recommendedLength: '5-10 emails',
    },
    {
      name: 'Program Nurture Sequence',
      purpose:
        'Explain EMBER, IGNITE, and PHOENIX through transformation, fit, and level of support.',
      recommendedLength: '5-8 emails',
    },
    {
      name: 'Weekly Capacity Note',
      purpose:
        'Maintain trust through weekly education, reflection, evidence, and gentle invitation.',
      recommendedLength: 'Ongoing',
    },
  ],

  ctaGuidelines: {
    purpose:
      'Email CTAs should feel like the next logical step in understanding herself.',

    examples: [
      'Take the Capacity Audit',
      'Read The Anastasis Shift',
      'Find your pathway',
      'Begin rebuilding',
      'Start understanding your capacity',
      'Explore the next step',
      'Continue your restoration',
    ],
  },

  analyticsToWatch: [
    'Open rate',
    'Click rate',
    'Reply rate',
    'Unsubscribe rate',
    'Audit completions',
    'Guide purchases',
    'Program applications',
    'Program conversions',
    'Sequence completion',
    'Most-clicked links',
  ],

  interpretation: {
    highOpenLowClick:
      'The subject line created interest, but the email may need a clearer invitation or stronger bridge.',

    lowOpenHighClick:
      'The content is valuable for those who open, but the subject line may need a clearer belief interruption.',

    highReplies:
      'The email created emotional safety and relational trust.',

    highUnsubscribe:
      'The sequence may be misaligned, too frequent, too sales-heavy, or attracting the wrong audience.',

    highAuditClicks:
      'The reader is ready to understand her capacity and should receive clear next-step support.',
  },

  postingStrategy: {
    cadence:
      'Minimum: 1 weekly email. During launches, audits, guide delivery, or program invitations, use structured sequences based on the reader’s stage.',

    weeklyMix: [
      '1 Weekly Capacity Note',
      '1 story or evidence email when available',
      '1 offer or pathway email only when strategically appropriate',
    ],
  },

  contentRules: [
    'Email should deepen trust, not overwhelm.',
    'Do not make every email a pitch.',
    'Teach one idea per email.',
    'Make the belief shift clear.',
    'Use replies as qualitative insight.',
    'Respect autonomy.',
    'Invite understanding before buying.',
    'Every email should leave her with more clarity than she had before.',
  ],

  successDefinition:
    'Email succeeds when women move from interest into trust, from trust into understanding, and from understanding into the next aligned step.',
} as const
