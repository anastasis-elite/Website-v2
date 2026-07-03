import type { ProgramLogicOutput } from '@/lib/dashboard/logic/types'

export type PhoenixRecipe = { id:string; title:string; reason:string; macros:{protein:number;carbs:number;fats:number;calories:number}; prepMinutes:number; ingredients:string[]; steps:string[] }

export function getPhoenixRecipeRecommendations({logic,client}:{logic:ProgramLogicOutput;client:any}):PhoenixRecipe[]{
  // TODO: Replace this rule-selected starter catalog with a managed recipe table and saved favorites.
  const avoid=String(client.allergies||client.intolerances||'').toLowerCase()
  const plantBased=/vegetarian|vegan|plant/.test(String(client.food_preferences||'').toLowerCase())
  const protein=plantBased?'tofu or lentils':avoid.includes('fish')?'chicken or tofu':avoid.includes('dairy')?'chicken, fish, or tofu':'Greek yogurt, chicken, fish, or tofu'
  const needsCarbs=logic.nutrition.carbs.remaining>logic.nutrition.protein.remaining
  const lowAppetite=logic.recoveryCheck.energy!==null&&logic.recoveryCheck.energy<=3
  const phase=logic.cycle.phase
  const recipes:PhoenixRecipe[]=[
    {id:'easy-protein-bowl',title:lowAppetite?'Gentle protein bowl':'Easy protein lunch',reason:lowAppetite?'Low energy calls for a soft, simple meal.':'Protein is the clearest remaining priority.',macros:{protein:32,carbs:38,fats:12,calories:390},prepMinutes:10,ingredients:[protein,'microwave rice or potatoes','easy vegetables','olive oil or simple sauce'],steps:['Warm the carbohydrate and vegetables.','Add one palm-sized protein serving.','Finish with sauce, salt, and water.']},
    {id:'post-workout-plate',title:'Simple high-carb post-workout meal',reason:needsCarbs?'Today’s remaining carbohydrates can support recovery.':'A balanced plate supports the assigned movement.',macros:{protein:35,carbs:62,fats:10,calories:480},prepMinutes:15,ingredients:[protein,'rice, pasta, or potatoes','fruit or vegetables','salt and preferred sauce'],steps:['Prepare the easiest carbohydrate available.','Add protein and produce.','Eat the amount that feels manageable; save the rest.']},
    {id:'comfort-dinner',title:phase==='luteal'?'Luteal comfort dinner with protein':'Low-decision comfort dinner',reason:phase==='luteal'?'Warm food, protein, and regular energy may support your current phase.':'This keeps dinner warm, complete, and easy.',macros:{protein:30,carbs:48,fats:16,calories:455},prepMinutes:20,ingredients:[plantBased?'lentils or tofu':'ground turkey, fish, or beans','potatoes or rice','frozen vegetables','broth or sauce'],steps:['Cook or reheat the protein.','Add the carbohydrate and vegetables.','Combine in one bowl and season simply.']},
  ]
  return recipes.slice(0,2)
}
