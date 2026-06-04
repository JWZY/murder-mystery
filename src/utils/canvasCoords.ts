import type { ViewportState } from '../types/canvas';

export function clientToCanvas(
  clientX: number,
  clientY: number,
  viewport: ViewportState,
): { x: number; y: number } {
  return {
    x: (clientX - viewport.panX) / viewport.zoom,
    y: (clientY - viewport.panY) / viewport.zoom,
  };
}

export function zoomAroundPoint(
  viewport: ViewportState,
  newZoom: number,
  clientX: number,
  clientY: number,
): ViewportState {
  const scale = newZoom / viewport.zoom;
  return {
    panX: clientX - (clientX - viewport.panX) * scale,
    panY: clientY - (clientY - viewport.panY) * scale,
    zoom: newZoom,
  };
}
