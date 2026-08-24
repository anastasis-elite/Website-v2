import type { ProgramLogicOutput } from '@/lib/dashboard/logic/types'

export type RecipeMealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export type Recipe = {
  id: string
  title: string
  description: string
  image_url?: string | null
  servings: number
  prep_minutes: number
  cook_minutes: number
  total_minutes: number
  ingredients: { name: string; quantity: string }[]
  instructions: string[]
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g?: number
  meal_type: RecipeMealType
  tags: string[]
  dietary_tags: string[]
  allergens: string[]
  cuisine?: string
  difficulty: 'easy' | 'moderate'
  substitutions?: string[]
  notes?: string
  created_at: string
  updated_at: string
}

const seedTimestamp = '2026-08-24T00:00:00.000Z'

export const seedRecipes: Recipe[] = [
  {
    id: 'protein-yogurt-berry-bowl',
    title: 'Protein Yogurt Berry Bowl',
    description: 'A fast breakfast with Greek yogurt, berries, oats, and seeds.',
    servings: 1,
    prep_minutes: 6,
    cook_minutes: 0,
    total_minutes: 6,
    ingredients: [
      { name: 'Greek yogurt', quantity: '1 cup' },
      { name: 'Berries', quantity: '1 cup' },
      { name: 'Rolled oats', quantity: '1/3 cup' },
      { name: 'Chia seeds', quantity: '1 tbsp' },
    ],
    instructions: ['Add yogurt to a bowl.', 'Top with berries, oats, and chia.', 'Stir or leave layered.'],
    calories: 360,
    protein_g: 34,
    carbs_g: 42,
    fat_g: 8,
    fiber_g: 9,
    meal_type: 'breakfast',
    tags: ['protein-forward', 'quick', 'no-cook'],
    dietary_tags: ['vegetarian'],
    allergens: ['dairy'],
    cuisine: 'general',
    difficulty: 'easy',
    substitutions: ['Use dairy-free high-protein yogurt if needed.'],
    created_at: seedTimestamp,
    updated_at: seedTimestamp,
  },
  {
    id: 'chicken-rice-lunch-bowl',
    title: 'Chicken Rice Lunch Bowl',
    description: 'A practical lunch bowl built from chicken, rice, vegetables, and sauce.',
    servings: 1,
    prep_minutes: 10,
    cook_minutes: 5,
    total_minutes: 15,
    ingredients: [
      { name: 'Cooked chicken breast', quantity: '5 oz' },
      { name: 'Cooked rice', quantity: '1 cup' },
      { name: 'Mixed vegetables', quantity: '1 cup' },
      { name: 'Olive oil or sauce', quantity: '1 tbsp' },
    ],
    instructions: ['Warm rice and vegetables.', 'Add chicken.', 'Finish with sauce and season to taste.'],
    calories: 520,
    protein_g: 44,
    carbs_g: 58,
    fat_g: 14,
    fiber_g: 6,
    meal_type: 'lunch',
    tags: ['protein-forward', 'meal-prep', 'post-workout'],
    dietary_tags: [],
    allergens: [],
    cuisine: 'general',
    difficulty: 'easy',
    created_at: seedTimestamp,
    updated_at: seedTimestamp,
  },
  {
    id: 'turkey-potato-comfort-skillet',
    title: 'Turkey Potato Comfort Skillet',
    description: 'A warm dinner with lean turkey, potatoes, vegetables, and broth.',
    servings: 2,
    prep_minutes: 10,
    cook_minutes: 20,
    total_minutes: 30,
    ingredients: [
      { name: 'Lean ground turkey', quantity: '12 oz' },
      { name: 'Diced potatoes', quantity: '2 cups' },
      { name: 'Frozen vegetables', quantity: '2 cups' },
      { name: 'Broth', quantity: '1/2 cup' },
    ],
    instructions: ['Brown turkey in a skillet.', 'Add potatoes and broth; cover until tender.', 'Stir in vegetables and season.'],
    calories: 455,
    protein_g: 35,
    carbs_g: 46,
    fat_g: 15,
    fiber_g: 7,
    meal_type: 'dinner',
    tags: ['comfort', 'protein-forward', 'easy-dinner'],
    dietary_tags: [],
    allergens: [],
    cuisine: 'general',
    difficulty: 'easy',
    created_at: seedTimestamp,
    updated_at: seedTimestamp,
  },
  {
    id: 'cottage-cheese-crunch-plate',
    title: 'Cottage Cheese Crunch Plate',
    description: 'A snack plate with cottage cheese, fruit, and whole-grain crackers.',
    servings: 1,
    prep_minutes: 5,
    cook_minutes: 0,
    total_minutes: 5,
    ingredients: [
      { name: 'Cottage cheese', quantity: '3/4 cup' },
      { name: 'Fruit', quantity: '1 serving' },
      { name: 'Whole-grain crackers', quantity: '1 serving' },
    ],
    instructions: ['Add cottage cheese to a bowl or plate.', 'Pair with fruit and crackers.', 'Season sweet or savory.'],
    calories: 310,
    protein_g: 28,
    carbs_g: 34,
    fat_g: 8,
    fiber_g: 5,
    meal_type: 'snack',
    tags: ['snack', 'quick', 'protein-forward'],
    dietary_tags: ['vegetarian'],
    allergens: ['dairy', 'gluten'],
    cuisine: 'general',
    difficulty: 'easy',
    substitutions: ['Use tuna, tofu dip, or hummus if avoiding dairy.'],
    created_at: seedTimestamp,
    updated_at: seedTimestamp,
  },
]

export function scaleRecipe(recipe: Recipe, servings: number) {
  const factor = servings / recipe.servings
  return {
    calories: Math.round(recipe.calories * factor),
    protein_g: Math.round(recipe.protein_g * factor),
    carbs_g: Math.round(recipe.carbs_g * factor),
    fat_g: Math.round(recipe.fat_g * factor),
    fiber_g: recipe.fiber_g === undefined ? undefined : Math.round(recipe.fiber_g * factor),
  }
}

export function getSeedRecipes() {
  return seedRecipes
}

export function selectRecipesForContext({ logic }: { logic: ProgramLogicOutput }) {
  const proteinRemaining = Number(logic.nutrition?.protein?.remaining ?? 0)
  if (proteinRemaining > 35) {
    return seedRecipes.filter((recipe) => recipe.protein_g >= 34).slice(0, 3)
  }
  return seedRecipes.slice(0, 3)
}
