import { useQuery } from 'deepspace'
import type { Clip } from '@/schemas/clips-schema'

/**
 * Loads one clip by id. The server only sends clips the caller may read
 * (published ones, plus their own drafts), so a missing clip means either
 * it doesn't exist or it's someone else's draft.
 */
export function useClip(id: string | undefined) {
  const { records, status } = useQuery<Clip>('clips')
  const clip = records.find((r) => r.recordId === id)
  return { clip, status }
}
