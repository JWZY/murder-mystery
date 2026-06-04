import type { CanvasItem } from '../types/canvas';

const SNAP_THRESHOLD = 8;

export interface SnapResult {
  x: number;
  y: number;
  guides: SnapGuide[];
}

export interface SnapGuide {
  axis: 'x' | 'y';
  position: number; // canvas coordinate of the guide line
}

/**
 * Given a dragged item's proposed position, snap to nearby items' edges/centers.
 * Returns the snapped position and any active guide lines.
 */
export function computeSnap(
  x: number,
  y: number,
  width: number,
  height: number,
  itemId: string,
  items: Record<string, CanvasItem>,
  itemOrder: string[],
): SnapResult {
  const guides: SnapGuide[] = [];

  // Dragged item edges & center
  const dragLeft = x;
  const dragRight = x + width;
  const dragCenterX = x + width / 2;
  const dragTop = y;
  const dragBottom = y + height;
  const dragCenterY = y + height / 2;

  let snappedX = x;
  let snappedY = y;
  let bestDx = SNAP_THRESHOLD + 1;
  let bestDy = SNAP_THRESHOLD + 1;

  // Collect all other visible top-level items
  for (const id of itemOrder) {
    if (id === itemId) continue;
    const other = items[id];
    if (!other) continue;

    const oLeft = other.x;
    const oRight = other.x + other.width;
    const oCenterX = other.x + other.width / 2;
    const oTop = other.y;
    const oBottom = other.y + other.height;
    const oCenterY = other.y + other.height / 2;

    // X-axis snaps: left-left, right-right, center-center, left-right, right-left
    const xChecks = [
      { drag: dragLeft, other: oLeft, offset: 0 },
      { drag: dragRight, other: oRight, offset: -width },
      { drag: dragCenterX, other: oCenterX, offset: -width / 2 },
      { drag: dragLeft, other: oRight, offset: 0 },
      { drag: dragRight, other: oLeft, offset: -width },
    ];

    for (const check of xChecks) {
      const d = Math.abs(check.drag - check.other);
      if (d < bestDx) {
        bestDx = d;
        snappedX = check.other + check.offset;
      }
    }

    // Y-axis snaps: top-top, bottom-bottom, center-center, top-bottom, bottom-top
    const yChecks = [
      { drag: dragTop, other: oTop, offset: 0 },
      { drag: dragBottom, other: oBottom, offset: -height },
      { drag: dragCenterY, other: oCenterY, offset: -height / 2 },
      { drag: dragTop, other: oBottom, offset: 0 },
      { drag: dragBottom, other: oTop, offset: -height },
    ];

    for (const check of yChecks) {
      const d = Math.abs(check.drag - check.other);
      if (d < bestDy) {
        bestDy = d;
        snappedY = check.other + check.offset;
      }
    }
  }

  // Only snap if within threshold
  if (bestDx > SNAP_THRESHOLD) snappedX = x;
  if (bestDy > SNAP_THRESHOLD) snappedY = y;

  // Build guide lines for active snaps
  if (snappedX !== x) {
    // Find which edge snapped to produce a guide line position
    const sl = snappedX;
    const sr = snappedX + width;
    const sc = snappedX + width / 2;
    for (const id of itemOrder) {
      if (id === itemId) continue;
      const o = items[id];
      if (!o) continue;
      const edges = [o.x, o.x + o.width, o.x + o.width / 2];
      for (const e of edges) {
        if (Math.abs(sl - e) < 1 || Math.abs(sr - e) < 1 || Math.abs(sc - e) < 1) {
          guides.push({ axis: 'x', position: e });
        }
      }
    }
  }

  if (snappedY !== y) {
    const st = snappedY;
    const sb = snappedY + height;
    const sc = snappedY + height / 2;
    for (const id of itemOrder) {
      if (id === itemId) continue;
      const o = items[id];
      if (!o) continue;
      const edges = [o.y, o.y + o.height, o.y + o.height / 2];
      for (const e of edges) {
        if (Math.abs(st - e) < 1 || Math.abs(sb - e) < 1 || Math.abs(sc - e) < 1) {
          guides.push({ axis: 'y', position: e });
        }
      }
    }
  }

  return { x: snappedX, y: snappedY, guides };
}
