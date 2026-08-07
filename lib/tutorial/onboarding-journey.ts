// lib/tutorial/onboarding-journey.ts

export interface OnboardingJourneyStep {
  id: string;

  title: string;

  body: string[];

  buttonText: string;

  /**
   * Optional UI spotlight target
   * Example: "capacity-checkin"
   */
  spotlightId?: string;

  /**
   * Action the user must complete
   * before continuing.
   */
  requiredAction?: string;

  /**
   * Prevent the user from skipping
   * until the required action completes.
   */
  waitForAction?: boolean;
}

export const onboardingJourney: OnboardingJourneyStep[] = [
  {
    id: "welcome",

    title: "Welcome Back",

    body: [
      "Before we begin...",
      "",
      "Take a moment to remember why you're here.",
      "",
      "You didn't come looking for another app.",
      "You came because something in your life needed to change."
    ],

    buttonText: "Continue"
  }
];
