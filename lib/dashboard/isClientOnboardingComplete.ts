type OnboardingClient = {
  onboarding_completed?: boolean | null
  birthdate?: string | null
  address_line_1?: string | null
  city?: string | null
  state?: string | null
  postal_code?: string | null
}

export function isClientOnboardingComplete(client: OnboardingClient) {
  return Boolean(
    client.onboarding_completed === true &&
      client.birthdate &&
      client.address_line_1 &&
      client.city &&
      client.state &&
      client.postal_code
  )
}
