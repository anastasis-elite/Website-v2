import { postureLandmarkDefinitions, type AssessmentView, type NormalizedPoint, type PostureLandmark, type PostureLandmarkName } from './landmarks'
import { clamp01 } from './geometry'

export type ManualLandmarkConfirmation = { complete: boolean; confirmedCount: number; visibleCount: number }

/** No estimate, confidence or person-detection state is created for manual work. */
export function createManualLandmarks(view: AssessmentView): PostureLandmark[] {
  return postureLandmarkDefinitions(view).map(definition => ({ ...definition,
    automatic: null, confirmed: null, manuallyAdjusted: false,
  }))
}

export function updateManualLandmark(landmarks: PostureLandmark[], name: PostureLandmarkName, point: NormalizedPoint | null): PostureLandmark[] {
  if (point && (!Number.isFinite(point.x) || !Number.isFinite(point.y))) return landmarks
  return landmarks.map(landmark => landmark.name !== name || !landmark.visible ? landmark : {
    ...landmark, automatic: null,
    confirmed: point ? { x: clamp01(point.x), y: clamp01(point.y) } : null,
    manuallyAdjusted: Boolean(point),
  })
}

export function manualLandmarkSummary(landmarks: PostureLandmark[]): ManualLandmarkConfirmation {
  const visible = landmarks.filter(landmark => landmark.visible)
  const confirmedCount = visible.filter(landmark => landmark.confirmed !== null).length
  return { confirmedCount, visibleCount: visible.length, complete: visible.length > 0 && confirmedCount === visible.length }
}
