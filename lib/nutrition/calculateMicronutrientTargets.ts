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
  age: number
  calories: number
  weightLbs: number
  waterOz: number
  cyclePhase?: CyclePhase
  trainingLevel?: TrainingLevel
}

function getFemaleBaseline(age: number) {
  if (age < 19) {
    return {
      calciumMg: 1300,
      ironMg: 15,
      magnesiumMg: 360,
      zincMg: 9,
      seleniumMcg: 55,
      cholineMg: 400,
      vitaminAMcg: 700,
      vitaminCMg: 65,
      vitaminDMcg: 15,
      vitaminEMg: 15,
      vitaminKMcg: 75,
      b1Mg: 1,
      b2Mg: 1,
      b3Mg: 14,
      b5Mg: 5,
      b6Mg: 1.2,
      b9Mcg: 400,
      b12Mcg: 2.4,
      potassiumMg: 2300,
    }
  }

  if (age <= 30) {
    return {
      calciumMg: 1000,
      ironMg: 18,
      magnesiumMg: 310,
      zincMg: 8,
      seleniumMcg: 55,
      cholineMg: 425,
      vitaminAMcg: 700,
      vitaminCMg: 75,
      vitaminDMcg: 15,
      vitaminEMg: 15,
      vitaminKMcg: 90,
      b1Mg: 1.1,
      b2Mg: 1.1,
      b3Mg: 14,
      b5Mg: 5,
      b6Mg: 1.3,
      b9Mcg: 400,
      b12Mcg: 2.4,
      potassiumMg: 2600,
    }
  }

  if (age <= 50) {
    return {
      calciumMg: 1000,
      ironMg: 18,
      magnesiumMg: 320,
      zincMg: 8,
      seleniumMcg: 55,
      cholineMg: 425,
      vitaminAMcg: 700,
      vitaminCMg: 75,
      vitaminDMcg: 15,
      vitaminEMg: 15,
      vitaminKMcg: 90,
      b1Mg: 1.1,
      b2Mg: 1.1,
      b3Mg: 14,
      b5Mg: 5,
      b6Mg: 1.3,
      b9Mcg: 400,
      b12Mcg: 2.4,
      potassiumMg: 2600,
    }
  }

  return {
    calciumMg: 1200,
    ironMg: 8,
    magnesiumMg: 320,
    zincMg: 8,
    seleniumMcg: 55,
    cholineMg: 425,
    vitaminAMcg: 700,
    vitaminCMg: 75,
    vitaminDMcg: age >= 71 ? 20 : 15,
    vitaminEMg: 15,
    vitaminKMcg: 90,
    b1Mg: 1.1,
    b2Mg: 1.1,
    b3Mg: 14,
    b5Mg: 5,
    b6Mg: age >= 51 ? 1.5 : 1.3,
    b9Mcg: 400,
    b12Mcg: 2.4,
    potassiumMg: 2600,
  }
}

function roundOne(value: number) {
  return Number(value.toFixed(1))
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function calculateMicronutrientTargets({
  age,
  calories,
  weightLbs,
  waterOz,
  cyclePhase = 'unknown',
  trainingLevel = 'general_fitness',
}: Input) {
  const baseline = getFemaleBaseline(age)

  const calorieFactor = calories / 2000
  const weightFactor = weightLbs / 150
  const waterFactor = waterOz / 90

  const softScale = clamp(Math.max(calorieFactor, weightFactor, 1), 1, 1.35)

  const fiberTargetG = Math.round(clamp((calories / 1000) * 14, 22, 50))

  let sodiumTargetMg = 2300
  let potassiumTargetMg = Math.round(baseline.potassiumMg * clamp(softScale, 1, 1.25))
  let magnesiumTargetMg = Math.round(baseline.magnesiumMg * clamp(softScale, 1, 1.25))

  let calciumTargetMg = baseline.calciumMg
  let ironTargetMg = baseline.ironMg
  let zincTargetMg = Math.round(baseline.zincMg * clamp(softScale, 1, 1.25))
  let seleniumTargetMcg = baseline.seleniumMcg
  let cholesterolLimitMg = 300
  let cholineTargetMg = baseline.cholineMg

  let vitaminATargetMcg = baseline.vitaminAMcg
  let vitaminCTargetMg = Math.round(baseline.vitaminCMg * clamp(softScale, 1, 1.25))
  let vitaminDTargetMcg = baseline.vitaminDMcg
  let vitaminETargetMg = baseline.vitaminEMg
  let vitaminKTargetMcg = baseline.vitaminKMcg

  let b1TargetMg = roundOne(baseline.b1Mg * clamp(calorieFactor, 1, 1.35))
  let b2TargetMg = roundOne(baseline.b2Mg * clamp(calorieFactor, 1, 1.35))
  let b3TargetMg = Math.round(baseline.b3Mg * clamp(calorieFactor, 1, 1.35))
  let b5TargetMg = baseline.b5Mg
  let b6TargetMg = roundOne(baseline.b6Mg * clamp(calorieFactor, 1, 1.25))
  let b9TargetMcg = baseline.b9Mcg
  let b12TargetMcg = baseline.b12Mcg

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
    b1TargetMg = roundOne(b1TargetMg + 0.2)
    b2TargetMg = roundOne(b2TargetMg + 0.2)
    b6TargetMg = roundOne(b6TargetMg + 0.2)
  }

  if (trainingLevel === 'recovery') {
    magnesiumTargetMg += 50
    vitaminCTargetMg += 25
  }

  if (cyclePhase === 'menstrual') {
    ironTargetMg += age <= 50 ? 2 : 0
    magnesiumTargetMg += 50
  }

  if (cyclePhase === 'luteal') {
    magnesiumTargetMg += 50
    potassiumTargetMg += 300
    b6TargetMg = roundOne(b6TargetMg + 0.2)
  }

  if (cyclePhase === 'ovulatory') {
    vitaminCTargetMg += 25
  }

  if (waterFactor > 1.1) {
    sodiumTargetMg += 300
    potassiumTargetMg += 200
  }

  sodiumTargetMg = clamp(sodiumTargetMg, 1500, 4000)
  potassiumTargetMg = clamp(potassiumTargetMg, baseline.potassiumMg, 5000)
  magnesiumTargetMg = clamp(magnesiumTargetMg, baseline.magnesiumMg, 600)
  calciumTargetMg = clamp(calciumTargetMg, 1000, 1300)
  ironTargetMg = clamp(ironTargetMg, baseline.ironMg, 27)
  zincTargetMg = clamp(zincTargetMg, baseline.zincMg, 15)
  vitaminCTargetMg = clamp(vitaminCTargetMg, baseline.vitaminCMg, 200)
  cholineTargetMg = clamp(cholineTargetMg, baseline.cholineMg, 550)

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
