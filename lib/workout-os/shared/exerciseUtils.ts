import type {
  CanonicalMuscle,
  WorkoutExercise,
} from '../types'

export function cloneExercises(
  exercises: WorkoutExercise[],
): WorkoutExercise[] {
  return exercises.map((exercise) => ({
    ...exercise,
    client_cues: exercise.client_cues
      ? [...exercise.client_cues]
      : undefined,
    tags: exercise.tags
      ? [...exercise.tags]
      : undefined,
    primary_muscles: exercise.primary_muscles
      ? [...exercise.primary_muscles]
      : undefined,
    secondary_muscles: exercise.secondary_muscles
      ? [...exercise.secondary_muscles]
      : undefined,
  }))
}

export function firstExercises(
  exercises: WorkoutExercise[],
  count: number,
): WorkoutExercise[] {
  return cloneExercises(exercises).slice(0, count)
}

export function hasStrengthExercises(
  exercises: WorkoutExercise[],
): boolean {
  return exercises.length > 0
}

export function addCue(
  exercise: WorkoutExercise,
  cue: string,
): WorkoutExercise {
  return {
    ...exercise,
    client_cues: [
      ...(exercise.client_cues ?? []),
      cue,
    ],
  }
}

export function replaceSets(
  exercise: WorkoutExercise,
  sets: number,
): WorkoutExercise {
  return {
    ...exercise,
    sets,
  }
}

export function replaceReps(
  exercise: WorkoutExercise,
  reps: number | string,
): WorkoutExercise {
  return {
    ...exercise,
    reps,
  }
}

export function replaceRest(
  exercise: WorkoutExercise,
  seconds: number,
): WorkoutExercise {
  return {
    ...exercise,
    rest_seconds: seconds,
  }
}

export function reduceVolume(
  exercise: WorkoutExercise,
): WorkoutExercise {
  let sets = Number(exercise.sets)

  if (!Number.isFinite(sets) || sets <= 1) {
    sets = 2
  } else {
    sets = Math.max(2, sets - 1)
  }

  return {
    ...exercise,
    sets,
  }
}

export function reduceIntensity(
  exercise: WorkoutExercise,
): WorkoutExercise {
  return {
    ...exercise,
    rpe_target: '6–7',
  }
}

export function normalizeWorkout(
  exercises: WorkoutExercise[],
): WorkoutExercise[] {
  return cloneExercises(exercises).filter(
    (exercise) =>
      Boolean(
        exercise.exercise ??
          exercise.name ??
          exercise.display_name,
      ),
  )
}

export function exerciseTargetsMuscle(
  exercise: WorkoutExercise,
  muscle: CanonicalMuscle,
): boolean {
  return (
    (exercise.primary_muscles?.includes(
      muscle,
    ) ??
    false) ||
    (exercise.secondary_muscles?.includes(
      muscle,
    ) ??
    false)
  )
}

export function removeExcludedMuscles(
  exercises: WorkoutExercise[],
  excluded: CanonicalMuscle[],
): WorkoutExercise[] {
  if (!excluded.length) return cloneExercises(exercises)

  return cloneExercises(exercises).filter(
    (exercise) =>
      !excluded.some((muscle) =>
        exerciseTargetsMuscle(
          exercise,
          muscle,
        ),
      ),
  )
}
