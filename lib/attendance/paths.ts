/** The standalone check-in (kiosk) page of one occurrence. */
export const CHECK_IN_PATH_RE = /^\/kegiatan\/\d+\/\d{4}-\d{2}-\d{2}\/absen\/?$/;

export function checkInPath(activityId: number, date: string): string {
  return `/kegiatan/${activityId}/${date}/absen`;
}
