// marketing/platforms/facebook.ts

export const facebookPlatform = {
  name: 'Facebook',

  role:
    'Community, conversation, and relationship-deepening platform for Anastasis. Facebook is where women can process the message more slowly, engage in discussion, and feel part of a movement rather than just an audience.',

  primaryObjective:
    'Move women from resonance into conversation, trust, community, and deeper participation in the Anastasis philosophy.',

  audienceState:
    'Warm, relational, and community-oriented. She may engage more through comments, groups, shares, longer captions, and personal conversation than fast-scrolling discovery.',

  bestFor: [
    'Community building',
    'Longer written reflections',
    'Discussion prompts',
    'Live trainings',
    'Founder stories',
    'Client/evidence wins',
    'Program education',
    'Capacity Audit invitations',
    'Private group support',
  ],

  strongestFormats: [
    'Long-form text posts',
    'Short reels reposted from TikTok/Instagram',
    'Facebook Lives',
    'Discussion prompts',
    'Polls',
    'Personal stories',
    'Educational posts',
    'Community questions',
    'Offer explanation posts',
    'Group announcements',
  ],

  pillarPriority: [
    'Identity',
    'Lifestyle',
    'Education',
    'Evidence',
    'Philosophy',
    'Invitation',
  ],

  strongestHookFamilies: [
    'Story',
    'Emotional',
    'Identity',
    'Authority',
    'Why Now',
    'Contrarian',
  ],

  contentStructure: [
    {
      step: 1,
      name: 'Recognition',
      purpose:
        'Name an experience she has lived.',
    },
    {
      step: 2,
      name: 'Reflection',
      purpose:
        'Give her space to process what it means.',
    },
    {
      step: 3,
      name: 'Reframe',
      purpose:
        'Replace self-blame with Human Engineering understanding.',
    },
    {
      step: 4,
      name: 'Question',
      purpose:
        'Invite conversation and self-reflection.',
    },
    {
      step: 5,
      name: 'Invitation',
      purpose:
        'Offer the next step when appropriate.',
    },
  ],

  postGuidelines: {
    tone:
      'Warmer, more conversational, and slightly more reflective than TikTok or Instagram.',

    bestLength:
      'Short reflections can be 3-7 sentences. Deeper posts can be 150-500 words.',

    style:
      'Write like a thoughtful founder speaking to women who are ready to process, not like a brand broadcasting at an audience.',
  },

  groupStrategy: {
    role:
      'Facebook Groups can become a community layer for women rebuilding capacity together.',

    bestUses: [
      'Daily reflections',
      'Capacity check-ins',
      'Educational prompts',
      'Recovery reminders',
      'Live Q&A',
      'Program support',
      'Community wins',
      'Soft invitations into deeper support',
    ],

    discussionPrompts: [
      'Where is your capacity being drained the most right now?',
      'What have you been blaming yourself for that might actually be feedback?',
      'What is one sign your body is asking for recovery?',
      'What does returning to yourself look like this week?',
      'What is one small piece of evidence that you are rebuilding?',
    ],
  },

  liveStrategy: {
    role:
      'Facebook Live should be used for relational teaching, Q&A, and deeper trust-building.',

    bestTopics: [
      'Why you do not have a discipline problem',
      'How to recognize low capacity',
      'Recovery as a performance tool',
      'What the Capacity Audit measures',
      'How Anastasis works',
      'Returning to yourself through Human Engineering',
    ],
  },

  captionGuidelines: {
    purpose:
      'Facebook captions should feel like reflections that invite women to pause, think, and respond.',

    ctaExamples: [
      'Comment CAPACITY if you want the audit.',
      'What part of this feels most true for you?',
      'Save this for the next time you blame yourself.',
      'Share this with a woman who has been carrying too much.',
      'Begin with the Capacity Audit.',
    ],
  },

  analyticsToWatch: [
    'Comments',
    'Shares',
    'Saves',
    'Group engagement',
    'Live attendance',
    'Live replay views',
    'DMs',
    'Link clicks',
    'Post reach',
    'Follower growth',
  ],

  interpretation: {
    highComments:
      'The post created conversation, recognition, or emotional safety.',

    highShares:
      'The message articulated something women want others to understand.',

    highGroupEngagement:
      'The community feels safe enough to participate.',

    highLiveReplayViews:
      'The topic is worth repurposing into YouTube, email, and carousel content.',

    highLinkClicks:
      'The audience is ready for the next step.',
  },

  postingStrategy: {
    cadence:
      '1-2 posts per day when capacity allows. Reels can be cross-posted from Instagram/TikTok. Groups should prioritize consistency over volume.',

    weeklyMix: [
      '2-3 reflective identity/story posts',
      '2 educational posts',
      '1 evidence or client win post',
      '1 lifestyle/reflection post',
      '1 invitation post when appropriate',
      '1 live or deeper discussion when capacity allows',
    ],
  },

  contentRules: [
    'Facebook should feel relational, not performative.',
    'Use questions to invite reflection.',
    'Do not overuse hard selling.',
    'Let longer captions breathe.',
    'Prioritize community safety and thoughtful discussion.',
    'Repurpose short-form video, but add reflective captions.',
    'Use Facebook to deepen trust with women who need more context before acting.',
  ],

  successDefinition:
    'Facebook succeeds when women move from silent recognition into conversation, reflection, community, and trust strong enough to take the next step.',
} as const
