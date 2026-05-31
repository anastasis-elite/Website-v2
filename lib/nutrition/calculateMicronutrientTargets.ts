export type CyclePhase =
  | 'menstrual'
  | 'follicular'
  | 'ovulatory'
  | 'luteal'
  | 'unknown'

export type TrainingLevel =
  | 'general_fitness'
  | 'high_sweat'
  | 'strength_hypertrophy'
  | 'endurance'
  | 'recovery'

type Input = {
  calories: number
  weightLbs: number
  waterOz: number
  cyclePhase?: CyclePhase
  trainingLevel?: TrainingLevel
}

export function calculateMicronutrientTargets({
  calories,
  weightLbs,
  waterOz,
  cyclePhase = 'unknown',
  trainingLevel = 'general_fitness',
}: Input) {
  const calorieFactor = calories / 2000
  const weightFactor = weightLbs / 150
  const waterFactor = waterOz / 90

  const fiberTargetG = Math.round((calories / 1000) * 14)

  let sodiumTargetMg = Math.round(2300 * calorieFactor)
  let potassiumTargetMg = Math.round(4700 * Math.max(calorieFactor, 0.9))
  let magnesiumTargetMg = Math.round(320 * Math.max(calorieFactor, weightFactor, 1))

  let calciumTargetMg = 1000
  let ironTargetMg = 18
  let zincTargetMg = Math.round(8 * Math.max(calorieFactor, 1))
  let seleniumTargetMcg = 55
  let cholesterolLimitMg = 300
  let cholineTargetMg = 425

  let vitaminATargetMcg = 700
  let vitaminCTargetMg = Math.round(75 * Math.max(calorieFactor, 1))
  let vitaminDTargetMcg = 15
  let vitaminETargetMg = 15
  let vitaminKTargetMcg = 90

  let b1TargetMg = Number((1.1 * Math.max(calorieFactor, 1)).toFixed(1))
  let b2TargetMg = Number((1.1 * Math.max(calorieFactor, 1)).toFixed(1))
  let b3TargetMg = Math.round(14 * Math.max(calorieFactor, 1))
  let b5TargetMg = 5
  let b6TargetMg = Number((1.3 * Math.max(calorieFactor, 1)).toFixed(1))
  let b9TargetMcg = 400
  let b12TargetMcg = 2.4

  if (trainingLevel === 'high_sweat') {
    sodiumTargetMg += 1000
    potassiumTargetMg += 500
    magnesiumTargetMg += 75
  }

  if (trainingLevel === 'strength_hypertrophy') {
    magnesiumTargetMg += 50
    potassiumTargetMg += 300
    zincTargetMg += 2
    vitaminCTargetMg += 25
  }

  if (trainingLevel === 'endurance') {
    sodiumTargetMg += 800
    potassiumTargetMg += 600
    magnesiumTargetMg += 75
    b1TargetMg += 0.2
    b2TargetMg += 0.2
    b6TargetMg += 0.2
  }

  if (trainingLevel === 'recovery') {
    magnesiumTargetMg += 50
    vitaminCTargetMg += 25
  }

  if (cyclePhase === 'menstrual') {
    ironTargetMg += 2
    magnesiumTargetMg += 50
  }

  if (cyclePhase === 'luteal') {
    magnesiumTargetMg += 50
    potassiumTargetMg += 300
    vitaminBump()
  }

  if (cyclePhase === 'ovulatory') {
    vitaminCTargetMg += 25
  }

  sodiumTargetMg = Math.max(sodiumTargetMg, 2300)
  potassiumTargetMg = Math.max(potassiumTargetMg, 3500)
  magnesiumTargetMg = Math.max(magnesiumTargetMg, 320)

  function vitaminBump() {
    b6TargetMg = Number((b6TargetMg + 0.2).toFixed(1))
  }

  return {
    fiber_target_g: fiberTargetG,
    sodium_target_mg: sodiumTargetMg,
    potassium_target_mg: potassiumTargetMg,
    magnesium_target_mg: magnesiumTargetMg,
    calcium_target_mg: calciumTargetMg,
    iron_target_mg: ironTargetMg,
    zinc_target_mg: zincTargetMg,
    selenium_target_mcg: seleniumTargetMcg,
    cholesterol_limit_mg: cholesterolLimitMg,
    choline_target_mg: cholineTargetMg,
    vitamin_a_target_mcg: vitaminATargetMcg,
    vitamin_c_target_mg: vitaminCTargetMg,
    vitamin_d_target_mcg: vitaminDTargetMcg,
    vitamin_e_target_mg: vitaminETargetMg,
    vitamin_k_target_mcg: vitaminKTargetMcg,
    b1_target_mg: b1TargetMg,
    b2_target_mg: b2TargetMg,
    b3_target_mg: b3TargetMg,
    b5_target_mg: b5TargetMg,
    b6_target_mg: b6TargetMg,
    b9_target_mcg: b9TargetMcg,
    b12_target_mcg: b12TargetMcg,
  }
}
