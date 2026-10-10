export type ActivityAchievement = { key: string; earned_at: string }

export function activityAchievementKey(achievement: ActivityAchievement): string {
  return `${achievement.key}:${achievement.earned_at}`
}

export function unannouncedActivityAchievements<T extends ActivityAchievement>(
  achievements: T[],
  seenKeys: ReadonlySet<string>,
): T[] {
  return achievements.filter(achievement => !seenKeys.has(activityAchievementKey(achievement)))
}
