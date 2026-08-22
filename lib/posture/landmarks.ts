export type AssessmentView = 'front' | 'back' | 'left' | 'right'
export type LandmarkSide = 'left' | 'right' | 'center'

export type NormalizedPoint = {
  x: number
  y: number
  confidence?: number | null
}

export type PostureLandmarkName =
  | 'head_top'
  | 'head_center'
  | 'left_ear'
  | 'right_ear'
  | 'neck'
  | 'upper_torso'
  | 'pelvis_center'
  | 'left_shoulder'
  | 'right_shoulder'
  | 'left_elbow'
  | 'right_elbow'
  | 'left_wrist'
  | 'right_wrist'
  | 'left_hip'
  | 'right_hip'
  | 'left_knee'
  | 'right_knee'
  | 'left_ankle'
  | 'right_ankle'
  | 'left_forefoot'
  | 'right_forefoot'
  | 'left_heel'
  | 'right_heel'

export type PostureLandmark = {
  name: PostureLandmarkName
  label: string
  side: LandmarkSide
  view: AssessmentView
  automatic: NormalizedPoint | null
  confirmed: NormalizedPoint | null
  manuallyAdjusted: boolean
  lowConfidence?: boolean
  visible: boolean
}

export type RawPoseLandmark = {
  name: string
  x: number
  y: number
  confidence?: number | null
}

export type PoseDetectionResult = {
  status: 'detected' | 'partial' | 'multiple_people' | 'no_person' | 'model_failed'
  message?: string
  landmarks: PostureLandmark[]
  rawLandmarks: RawPoseLandmark[]
}

export const POSTURE_VIEW_LABELS: Record<AssessmentView, string> = {
  front: 'Front',
  back: 'Back',
  left: 'Left side',
  right: 'Right side',
}

export const postureInstructions = [
  'Stand naturally rather than correcting your posture.',
  'Show your full body from head through feet with space around you.',
  'Use a clear, well-lit area and clothing that makes major body landmarks visible.',
  'Keep the camera approximately level and avoid posing, flexing, or changing your stance.',
]

const bilateralBase: Array<{ name: PostureLandmarkName; label: string; side: LandmarkSide }> = [
  { name: 'left_shoulder', label: 'Left shoulder', side: 'left' },
  { name: 'right_shoulder', label: 'Right shoulder', side: 'right' },
  { name: 'left_elbow', label: 'Left elbow', side: 'left' },
  { name: 'right_elbow', label: 'Right elbow', side: 'right' },
  { name: 'left_wrist', label: 'Left wrist', side: 'left' },
  { name: 'right_wrist', label: 'Right wrist', side: 'right' },
  { name: 'left_hip', label: 'Left hip', side: 'left' },
  { name: 'right_hip', label: 'Right hip', side: 'right' },
  { name: 'left_knee', label: 'Left knee', side: 'left' },
  { name: 'right_knee', label: 'Right knee', side: 'right' },
  { name: 'left_ankle', label: 'Left ankle', side: 'left' },
  { name: 'right_ankle', label: 'Right ankle', side: 'right' },
  { name: 'left_forefoot', label: 'Left forefoot/toe', side: 'left' },
  { name: 'right_forefoot', label: 'Right forefoot/toe', side: 'right' },
]

const centerBase: Array<{ name: PostureLandmarkName; label: string; side: LandmarkSide }> = [
  { name: 'head_top', label: 'Top of head', side: 'center' },
  { name: 'head_center', label: 'Head center', side: 'center' },
  { name: 'neck', label: 'Neck', side: 'center' },
  { name: 'upper_torso', label: 'Upper torso', side: 'center' },
  { name: 'pelvis_center', label: 'Pelvis center', side: 'center' },
]

const sideVisible: Record<Extract<AssessmentView, 'left' | 'right'>, PostureLandmarkName[]> = {
  left: [
    'head_top',
    'head_center',
    'left_ear',
    'neck',
    'upper_torso',
    'left_shoulder',
    'left_hip',
    'left_knee',
    'left_ankle',
    'left_forefoot',
    'left_heel',
  ],
  right: [
    'head_top',
    'head_center',
    'right_ear',
    'neck',
    'upper_torso',
    'right_shoulder',
    'right_hip',
    'right_knee',
    'right_ankle',
    'right_forefoot',
    'right_heel',
  ],
}

const sideExtras: Array<{ name: PostureLandmarkName; label: string; side: LandmarkSide }> = [
  { name: 'left_ear', label: 'Left ear/head reference', side: 'left' },
  { name: 'right_ear', label: 'Right ear/head reference', side: 'right' },
  { name: 'left_heel', label: 'Left heel', side: 'left' },
  { name: 'right_heel', label: 'Right heel', side: 'right' },
]

export function postureLandmarkDefinitions(view: AssessmentView) {
  const definitions =
    view === 'front' || view === 'back'
      ? [...centerBase, ...bilateralBase]
      : [...centerBase, ...sideExtras, ...bilateralBase]

  return definitions.map((definition) => ({
    ...definition,
    view,
    visible:
      view === 'front' ||
      view === 'back' ||
      sideVisible[view].includes(definition.name),
  }))
}

export const frontBackConnections: Array<[PostureLandmarkName, PostureLandmarkName]> = [
  ['head_top', 'head_center'],
  ['head_center', 'neck'],
  ['neck', 'left_shoulder'],
  ['neck', 'right_shoulder'],
  ['left_shoulder', 'right_shoulder'],
  ['neck', 'upper_torso'],
  ['upper_torso', 'pelvis_center'],
  ['left_shoulder', 'left_elbow'],
  ['left_elbow', 'left_wrist'],
  ['right_shoulder', 'right_elbow'],
  ['right_elbow', 'right_wrist'],
  ['left_hip', 'right_hip'],
  ['pelvis_center', 'left_hip'],
  ['pelvis_center', 'right_hip'],
  ['left_hip', 'left_knee'],
  ['left_knee', 'left_ankle'],
  ['left_ankle', 'left_forefoot'],
  ['right_hip', 'right_knee'],
  ['right_knee', 'right_ankle'],
  ['right_ankle', 'right_forefoot'],
]

export const sideConnections: Record<Extract<AssessmentView, 'left' | 'right'>, Array<[PostureLandmarkName, PostureLandmarkName]>> = {
  left: [
    ['head_top', 'head_center'],
    ['head_center', 'left_ear'],
    ['head_center', 'neck'],
    ['neck', 'left_shoulder'],
    ['left_shoulder', 'upper_torso'],
    ['upper_torso', 'left_hip'],
    ['left_hip', 'left_knee'],
    ['left_knee', 'left_ankle'],
    ['left_ankle', 'left_forefoot'],
    ['left_ankle', 'left_heel'],
  ],
  right: [
    ['head_top', 'head_center'],
    ['head_center', 'right_ear'],
    ['head_center', 'neck'],
    ['neck', 'right_shoulder'],
    ['right_shoulder', 'upper_torso'],
    ['upper_torso', 'right_hip'],
    ['right_hip', 'right_knee'],
    ['right_knee', 'right_ankle'],
    ['right_ankle', 'right_forefoot'],
    ['right_ankle', 'right_heel'],
  ],
}

export function connectionsForView(view: AssessmentView) {
  return view === 'front' || view === 'back' ? frontBackConnections : sideConnections[view]
}
