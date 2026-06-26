// marketing/platforms/threads.ts

export const threadsPlatform = {
  name: 'Threads',

  role:
    'Thought leadership, belief-shifting, and conversation platform for Anastasis. Threads is where short written ideas can create recognition, curiosity, and deeper philosophical connection.',

  primaryObjective:
    'Use concise written reflections to challenge old beliefs, introduce Human Engineering language, and invite thoughtful conversation.',

  audienceState:
    'Warm or warming. She may engage with ideas, reflections, founder thoughts, and belief shifts more than polished visual content.',

  bestFor: [
    'Thought leadership',
    'Belief shifts',
    'Founder reflections',
    'Short philosophy posts',
    'Conversation starters',
    'Capacity reframes',
    'Human Engineering language',
    'Soft invitations',
  ],

  strongestFormats: [
    'One-line belief interruptions',
    'Short reflections',
    'Mini threads',
    'Contrarian statements',
    'Observation posts',
    'Questions',
    'Founder notes',
    'Repurposed caption excerpts',
  ],

  pillarPriority: [
    'Philosophy',
    'Identity',
    'Education',
    'Evidence',
    'Invitation',
    'Lifestyle',
  ],

  strongestHookFamilies: [
    'Contrarian',
    'Authority',
    'Identity',
    'Emotional',
    'Curiosity',
    'Why Now',
  ],

  contentStructure: [
    {
      step: 1,
      name: 'Observation',
      purpose: 'Name a pattern or belief.',
    },
    {
      step: 2,
      name: 'Reframe',
      purpose: 'Offer a new way to understand it.',
    },
    {
      step: 3,
      name: 'Reflection',
      purpose: 'Invite the reader to consider herself differently.',
    },
    {
      step: 4,
      name: 'Invitation',
      purpose: 'Offer a soft next step when appropriate.',
    },
  ],

  postGuidelines: {
    tone:
      'Short, thoughtful, direct, calm, and reflective. Threads should sound like distilled Anastasis thinking.',

    bestLength:
      '1-5 sentences for most posts. Use longer threads only when teaching a framework.',

    style:
      'Write like a founder documenting the philosophy in real time, not like a brand trying to go viral.',
  },

  examples: [
    'You do not need more discipline. You need more capacity.',
    'Your body is not failing you. It is adapting to what life has required from you.',
    'Health should give you your life back—not become another demand on it.',
    'The strongest women I know are not the ones who never rest.',
    'Recovery is not the opposite of progress. It is where adaptation happens.',
    'The woman you miss is not gone. She has been buried under survival.',
    'If your system requires constant willpower, the system is the problem.',
    'You cannot shame yourself into self-trust.',
  ],

  conversationPrompts: [
    'What is one thing you have been blaming yourself for that might actually be feedback?',
    'Where does your life require more capacity right now?',
    'What would change if health felt supportive instead of demanding?',
    'What is one sign your body has been asking for recovery?',
    'What does returning to yourself mean to you?',
  ],

  analyticsToWatch: [
    'Replies',
    'Reposts',
    'Likes',
    'Profile visits',
    'Follows',
    'Link clicks',
    'DMs',
  ],

  interpretation: {
    highReplies:
      'The post created reflection, recognition, or conversation.',

    highReposts:
      'The wording captured a belief shift people want others to understand.',

    highLikesLowReplies:
      'The post resonated quietly but may not have invited conversation.',

    highProfileVisits:
      'The idea created enough curiosity to investigate Anastasis further.',
  },

  postingStrategy: {
    cadence:
      '2-5 posts per day when capacity allows. Threads can be used as a low-friction place to test language before turning ideas into reels, captions, emails, or long-form content.',

    dailyMix: [
      '1 belief interruption',
      '1 reflective observation',
      '1 Human Engineering reframe',
      '1 question or conversation prompt',
      '1 soft invitation when relevant',
    ],
  },

  contentRules: [
    'Do not sound like generic inspirational content.',
    'Do not post vague motivation.',
    'Make every post carry a belief shift.',
    'Use Threads to test language before expanding it elsewhere.',
    'Keep the voice calm, intelligent, and human.',
    'Let posts feel like thoughts worth saving.',
    'Do not manufacture urgency.',
  ],

  successDefinition:
    'Threads succeeds when short written ideas make women pause, rethink what they have believed, and begin associating Anastasis with clarity, capacity, and Human Engineering.',
} as const
