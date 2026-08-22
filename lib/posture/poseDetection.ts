'use client'

import {
  type AssessmentView,
  type NormalizedPoint,
  type PoseDetectionResult,
  type PostureLandmark,
  type PostureLandmarkName,
  postureLandmarkDefinitions,
} from './landmarks'
import { averageConfidence, clamp01, midpoint, normalizePoint } from './geometry'

type DetectorModule = typeof import('@tensorflow-models/pose-detection')
type Detector = Awaited<ReturnType<DetectorModule['createDetector']>>

let detectorPromise: Promise<Detector> | null = null

function scoreOf(point: any) {
  return typeof point?.score === 'number'
    ? point.score
    : typeof point?.confidence === 'number'
      ? point.confidence
      : null
}

function keypointMap(keypoints: any[], imageWidth: number, imageHeight: number) {
  return keypoints.reduce<Record<string, NormalizedPoint>>((map, point) => {
    const name = String(point.name || point.part || '').toLowerCase()
    if (!name) return map
    map[name] = normalizePoint(
      { x: Number(point.x), y: Number(point.y), confidence: scoreOf(point) },
      imageWidth,
      imageHeight,
    )
    return map
  }, {})
}

function confidence(...points: Array<NormalizedPoint | null | undefined>) {
  return averageConfidence(...points)
}

function topOfHead(points: Record<string, NormalizedPoint>) {
  const headPoints = [
    points.nose,
    points.left_eye,
    points.right_eye,
    points.left_ear,
    points.right_ear,
  ].filter(Boolean)

  if (!headPoints.length) return null
  const minY = Math.min(...headPoints.map((point) => point.y))
  const centerX = headPoints.reduce((sum, point) => sum + point.x, 0) / headPoints.length
  return { x: clamp01(centerX), y: clamp01(minY - 0.035), confidence: confidence(...headPoints) }
}

function buildPointMap(points: Record<string, NormalizedPoint>) {
  const neck = midpoint(points.left_shoulder, points.right_shoulder)
  const upperTorso = midpoint(neck, midpoint(points.left_hip, points.right_hip))
  const pelvisCenter = midpoint(points.left_hip, points.right_hip)
  const headCenter = midpoint(
    points.left_ear || points.left_eye || points.nose,
    points.right_ear || points.right_eye || points.nose,
  ) || points.nose || null

  return {
    head_top: topOfHead(points),
    head_center: headCenter,
    left_ear: points.left_ear || null,
    right_ear: points.right_ear || null,
    neck,
    upper_torso: upperTorso,
    pelvis_center: pelvisCenter,
    left_shoulder: points.left_shoulder || null,
    right_shoulder: points.right_shoulder || null,
    left_elbow: points.left_elbow || null,
    right_elbow: points.right_elbow || null,
    left_wrist: points.left_wrist || null,
    right_wrist: points.right_wrist || null,
    left_hip: points.left_hip || null,
    right_hip: points.right_hip || null,
    left_knee: points.left_knee || null,
    right_knee: points.right_knee || null,
    left_ankle: points.left_ankle || null,
    right_ankle: points.right_ankle || null,
    left_forefoot: points.left_foot_index || null,
    right_forefoot: points.right_foot_index || null,
    left_heel: points.left_heel || null,
    right_heel: points.right_heel || null,
  } satisfies Record<PostureLandmarkName, NormalizedPoint | null>
}

function fallbackLandmarks(view: AssessmentView): PostureLandmark[] {
  const x = view === 'right' ? 0.56 : 0.44
  const side = view === 'front' || view === 'back'
    ? {
        left: 0.38,
        right: 0.62,
      }
    : {
        left: x,
        right: x,
      }

  const defaults: Partial<Record<PostureLandmarkName, NormalizedPoint>> = {
    head_top: { x, y: 0.08 },
    head_center: { x, y: 0.14 },
    neck: { x, y: 0.22 },
    upper_torso: { x, y: 0.34 },
    pelvis_center: { x, y: 0.52 },
    left_shoulder: { x: side.left, y: 0.24 },
    right_shoulder: { x: side.right, y: 0.24 },
    left_elbow: { x: side.left - 0.08, y: 0.38 },
    right_elbow: { x: side.right + 0.08, y: 0.38 },
    left_wrist: { x: side.left - 0.08, y: 0.5 },
    right_wrist: { x: side.right + 0.08, y: 0.5 },
    left_hip: { x: side.left + 0.02, y: 0.53 },
    right_hip: { x: side.right - 0.02, y: 0.53 },
    left_knee: { x: side.left + 0.01, y: 0.72 },
    right_knee: { x: side.right - 0.01, y: 0.72 },
    left_ankle: { x: side.left, y: 0.91 },
    right_ankle: { x: side.right, y: 0.91 },
    left_forefoot: { x: side.left + 0.04, y: 0.95 },
    right_forefoot: { x: side.right - 0.04, y: 0.95 },
    left_ear: { x, y: 0.15 },
    right_ear: { x, y: 0.15 },
    left_heel: { x: side.left - 0.02, y: 0.95 },
    right_heel: { x: side.right + 0.02, y: 0.95 },
  }

  return postureLandmarkDefinitions(view).map((definition) => {
    const point = defaults[definition.name] || null
    return {
      ...definition,
      automatic: point,
      confirmed: point,
      manuallyAdjusted: false,
      lowConfidence: true,
    }
  })
}

async function getDetector() {
  if (!detectorPromise) {
    detectorPromise = Promise.all([
      import('@tensorflow/tfjs-core'),
      import('@tensorflow/tfjs-backend-webgl'),
      import('@tensorflow-models/pose-detection'),
    ]).then(async ([tf, , poseDetection]) => {
      await tf.setBackend('webgl')
      await tf.ready()
      return poseDetection.createDetector(poseDetection.SupportedModels.BlazePose, {
        runtime: 'tfjs',
        modelType: 'lite',
        enableSmoothing: false,
      })
    })
  }

  return detectorPromise
}

export async function estimatePostureLandmarks(
  image: HTMLImageElement,
  view: AssessmentView,
): Promise<PoseDetectionResult> {
  const imageWidth = image.naturalWidth || image.width
  const imageHeight = image.naturalHeight || image.height

  try {
    const detector = await getDetector()
    const poses = await detector.estimatePoses(image, { flipHorizontal: false })

    if (poses.length > 1) {
      return {
        status: 'multiple_people',
        message: 'Use a photo containing only you, then adjust any points that need correction.',
        landmarks: fallbackLandmarks(view),
        rawLandmarks: [],
      }
    }

    if (!poses.length) {
      return {
        status: 'no_person',
        message: 'We could not locate a full body automatically. Place the points manually.',
        landmarks: fallbackLandmarks(view),
        rawLandmarks: [],
      }
    }

    const rawKeypoints = poses[0].keypoints || []
    const normalized = keypointMap(rawKeypoints, imageWidth, imageHeight)
    const pointMap = buildPointMap(normalized)
    const landmarks = postureLandmarkDefinitions(view).map((definition) => {
      const point = pointMap[definition.name] || null
      const lowConfidence = !point || (typeof point.confidence === 'number' && point.confidence < 0.45)
      return {
        ...definition,
        automatic: point,
        confirmed: point,
        manuallyAdjusted: false,
        lowConfidence,
      }
    })

    const visibleLandmarks = landmarks.filter((landmark) => landmark.visible)
    const detectedCount = visibleLandmarks.filter((landmark) => landmark.confirmed && !landmark.lowConfidence).length

    return {
      status: detectedCount < Math.max(3, visibleLandmarks.length * 0.55) ? 'partial' : 'detected',
      message: detectedCount < visibleLandmarks.length
        ? 'Some points may need manual adjustment.'
        : undefined,
      landmarks,
      rawLandmarks: rawKeypoints.map((point: any) => ({
        name: String(point.name || point.part || ''),
        x: clamp01(Number(point.x) / imageWidth),
        y: clamp01(Number(point.y) / imageHeight),
        confidence: scoreOf(point),
      })),
    }
  } catch (error) {
    console.error('Pose estimation failed', error)
    return {
      status: 'model_failed',
      message: 'Automatic landmark placement is unavailable right now. Place or adjust the points manually.',
      landmarks: fallbackLandmarks(view),
      rawLandmarks: [],
    }
  }
}
