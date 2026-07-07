/**
 * MediaPipe Face Landmarker helpers.
 *
 * The Face Landmarker returns 478 normalized landmarks (x,y,z in 0..1) —
 * 468 face mesh points plus 10 iris points (5 per eye). We derive the pieces
 * the scanner HUD needs: per-eye centers, iris centers, an openness proxy, and
 * head pose (yaw/pitch/roll) from the facial transformation matrix.
 */

export interface Point {
  x: number;
  y: number;
}

export interface HeadPose {
  yaw: number; // + = turned to viewer's right
  pitch: number; // + = looking up
  roll: number; // + = head tilted
}

// Iris landmark ranges (with refined landmarks, indices 468..477).
const LEFT_IRIS = [468, 469, 470, 471, 472];
const RIGHT_IRIS = [473, 474, 475, 476, 477];

// Eyelid landmarks used for eye center + openness.
const LEFT_EYE = { corners: [33, 133], lids: [159, 145] }; // outer,inner ; upper,lower
const RIGHT_EYE = { corners: [362, 263], lids: [386, 374] };

type LM = { x: number; y: number; z?: number };

function centroid(landmarks: LM[], indices: number[]): Point | undefined {
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (const i of indices) {
    const p = landmarks[i];
    if (!p) return undefined;
    sx += p.x;
    sy += p.y;
    n++;
  }
  return n ? { x: sx / n, y: sy / n } : undefined;
}

function dist(a: LM, b: LM): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export interface EyeInfo {
  center: Point;
  iris: Point;
  openness: number; // 0 (closed) .. ~1 (open), normalized by eye width
}

function eyeInfo(landmarks: LM[], eye: typeof LEFT_EYE, irisIdx: number[]): EyeInfo | undefined {
  const iris = centroid(landmarks, irisIdx);
  const center = centroid(landmarks, eye.corners);
  if (!iris || !center) return undefined;
  const [outer, inner] = eye.corners.map((i) => landmarks[i]);
  const [upper, lower] = eye.lids.map((i) => landmarks[i]);
  if (!outer || !inner || !upper || !lower) return undefined;
  const width = dist(outer, inner) || 1e-6;
  const openness = dist(upper, lower) / width;
  return { center, iris, openness };
}

export interface FaceGeometry {
  /** Eyes labeled by image position: left = smaller x. */
  left?: EyeInfo;
  right?: EyeInfo;
  /** Bounding box of the face in normalized coords. */
  bbox?: { x: number; y: number; w: number; h: number };
}

export function extractGeometry(landmarks: LM[]): FaceGeometry {
  const a = eyeInfo(landmarks, LEFT_EYE, LEFT_IRIS);
  const b = eyeInfo(landmarks, RIGHT_EYE, RIGHT_IRIS);

  let left = a;
  let right = b;
  if (a && b && a.center.x > b.center.x) {
    left = b;
    right = a;
  }

  // Face bbox from min/max of all landmarks.
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  for (const p of landmarks) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const bbox =
    landmarks.length > 0 ? { x: minX, y: minY, w: maxX - minX, h: maxY - minY } : undefined;

  return { left, right, bbox };
}

/**
 * Head pose from the 4x4 facial transformation matrix (column-major, length 16).
 * Standard XYZ Euler extraction; returned in degrees. Approximate but stable
 * enough for alignment guidance.
 */
export function headPoseFromMatrix(data: number[] | Float32Array): HeadPose {
  const r00 = data[0];
  const r10 = data[1];
  const r20 = data[2];
  const r21 = data[6];
  const r22 = data[10];
  const sy = Math.hypot(r00, r10);
  const pitch = Math.atan2(r21, r22);
  const yaw = Math.atan2(-r20, sy);
  const roll = Math.atan2(r10, r00);
  const deg = (r: number) => (r * 180) / Math.PI;
  return { yaw: deg(yaw), pitch: deg(pitch), roll: deg(roll) };
}

/** How well-aligned the head is for a scan (0..1). Penalizes yaw/pitch/roll. */
export function alignmentScore(pose: HeadPose | undefined): number {
  if (!pose) return 0;
  const penalty = (Math.abs(pose.yaw) + Math.abs(pose.pitch) + Math.abs(pose.roll) * 0.5) / 60;
  return Math.max(0, Math.min(1, 1 - penalty));
}
