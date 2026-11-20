import { getBeijingDate } from './date';
import { evangelistContributionLimits, getEvangelistRule } from './evangelist-rules';
export interface ContributionLimitRecord { id?: number; type?: string; points?: number; date?: string | null }
export interface ContributionLimitStatus { currentPoints: number; draftPoints: number; projectedPoints: number; limit: number; exceededBy: number }
export function calculateEvangelistContributionLimit(contributions: ContributionLimitRecord[], draft: ContributionLimitRecord, year = Number(getBeijingDate().slice(0,4))): ContributionLimitStatus | null {
  const limit = draft.type ? evangelistContributionLimits[draft.type] : undefined;
  const yearPrefix = `${year}-`;
  if (!limit || draft.date && !draft.date.startsWith(yearPrefix)) return null;
  const currentPoints = contributions.reduce((total, contribution) => {
    const isCurrentRecord = draft.id !== undefined && contribution.id === draft.id;
    const isSameType = getEvangelistRule(contribution.type)?.name === getEvangelistRule(draft.type)?.name;
    const isInPlanYear = !contribution.date || contribution.date.startsWith(yearPrefix);
    return isCurrentRecord || !isSameType || !isInPlanYear ? total : total + (Number(contribution.points) || 0);
  }, 0);
  const draftPoints = Number(draft.points) || 0, projectedPoints = currentPoints + draftPoints;
  return { currentPoints, draftPoints, projectedPoints, limit, exceededBy: Math.max(0,projectedPoints-limit) };
}
