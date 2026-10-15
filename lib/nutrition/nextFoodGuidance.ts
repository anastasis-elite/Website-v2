type FoodOption = { name: string; serving: string | null }

export function getNextFoodGuidance({
  dataStatus,
  mealSuggestions,
  suggestedFoods,
}: {
  dataStatus: string
  mealSuggestions: string[]
  suggestedFoods: FoodOption[]
}) {
  const first = suggestedFoods[0]
  if (first) {
    return {
      copy: `Consider ${first.name}${first.serving ? ` (${first.serving})` : ''}.${dataStatus === 'needs_input' ? ' No prior meal logs needed to explore starting options.' : ''}`,
      showSuggestedAction: true,
    }
  }
  if (dataStatus === 'needs_input') {
    return {
      copy: 'Choose a starting food option in Suggested Foods. No prior meal logs needed.',
      showSuggestedAction: true,
    }
  }
  return { copy: mealSuggestions[0] || 'Review Suggested Foods for your next food option.', showSuggestedAction: true }
}
