import { useLiveQuery } from "dexie-react-hooks";
import { createRepo } from "@/data/repo";
import type { Session, SetGroup, WorkoutSet } from "@/domain/types";

export const repo = createRepo();

export function useSettings() {
  return useLiveQuery(() => repo.getSettings(), []);
}

/** undefined = loading, null = no active programme */
export function useActiveProgram() {
  return useLiveQuery(async () => (await repo.getActiveProgram()) ?? null, []);
}

export function useCurrentTM() {
  return useLiveQuery(() => repo.currentTM(), []);
}

export function useProgramSessions(programId: string | undefined) {
  return useLiveQuery(() => (programId ? repo.programSessions(programId) : Promise.resolve([] as Session[])), [programId]);
}

/** undefined = loading, null = nothing left to do */
export function useNextSession(programId: string | undefined | null) {
  return useLiveQuery(async () => (programId ? ((await repo.nextSession(programId)) ?? null) : null), [programId]);
}

export interface SessionData {
  session: Session;
  groups: SetGroup[];
  sets: WorkoutSet[];
}

export function useSessionData(sessionId: string | undefined) {
  return useLiveQuery(async (): Promise<SessionData | null> => {
    if (!sessionId) return null;
    const session = await repo.db.sessions.get(sessionId);
    if (!session) return null;
    const [groups, sets] = await Promise.all([repo.sessionGroups(sessionId), repo.sessionSets(sessionId)]);
    return { session, groups, sets };
  }, [sessionId]);
}

export function useExercises() {
  return useLiveQuery(() => repo.db.exercises.toArray(), []);
}
