import { describe, expect, it } from 'vitest'
import { activityAchievementKey, unannouncedActivityAchievements } from './academy-achievement-announcement'

describe('activity achievement announcements', () => {
  it('announces a server award once and does not replay its persisted grant', () => {
    const award = { key: 'first-evidence-investigation', earned_at: '2026-10-10T12:00:00Z' }
    const seen = new Set([activityAchievementKey(award)])

    expect(unannouncedActivityAchievements([award], new Set())).toEqual([award])
    expect(unannouncedActivityAchievements([award], seen)).toEqual([])
  })

  it('treats a newly timestamped server grant as a new award', () => {
    const prior = { key: 'first-evidence-investigation', earned_at: '2026-10-10T12:00:00Z' }
    const next = { ...prior, earned_at: '2026-10-11T12:00:00Z' }

    expect(unannouncedActivityAchievements([next], new Set([activityAchievementKey(prior)]))).toEqual([next])
  })
})
