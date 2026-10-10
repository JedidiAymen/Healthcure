import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export const queryKeys = {
  health: ["health"] as const,
  modules: ["modules"] as const,
  cases: ["cases"] as const,
  runs: ["runs"] as const,
  reports: ["reports"] as const,
  models: ["models"] as const,
  studentChallenges: ["student", "challenges"] as const,
  studentLearningPaths: ["student", "learning-paths"] as const,
  studentProgress: ["student", "progress"] as const,
  educatorDrafts: ["educator", "drafts"] as const,
  educatorAssignments: ["educator", "assignments"] as const,
  educatorCohorts: ["educator", "cohorts"] as const,
  educatorAssignmentAttempts: (assignmentId: string) => ["educator", "assignment-attempts", assignmentId] as const,
};
