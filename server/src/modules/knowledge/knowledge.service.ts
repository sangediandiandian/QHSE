import type { EmergencyPlanService } from '../emergency-plans/emergency-plan.service';
import type { EmergencyPlan } from '../emergency-plans/emergency-plan.types';
import type { EventReviewService } from '../event-reviews/event-review.service';
import type { EventReview } from '../event-reviews/event-review.types';
import type { HazardService } from '../hazards/hazard.service';
import type { Hazard } from '../hazards/hazard.types';
import type { KnowledgeQueryDto } from './knowledge-query.dto';
import type { KnowledgeSearchItem, KnowledgeSearchResult } from './knowledge.types';

interface Candidate extends Omit<KnowledgeSearchItem, 'score' | 'highlights'> {
  searchable: string[];
}

const normalize = (value: string) => value.trim().toLocaleLowerCase('zh-CN');

function searchTerms(keyword: string) {
  const words = keyword.split(/\s+/).filter(Boolean);
  if (words.length !== 1 || !/[\u3400-\u9fff]/.test(keyword)) return [...new Set(words)];
  const characters = Array.from(keyword);
  if (characters.length < 3 || characters.length > 12) return words;
  return [
    ...new Set(
      Array.from({ length: characters.length - 1 }, (_, index) =>
        characters.slice(index, index + 2).join(''),
      ),
    ),
  ];
}

function scoreCandidate(candidate: Candidate, keyword: string, terms: string[]) {
  const code = normalize(candidate.code);
  const title = normalize(candidate.title);
  const searchable = candidate.searchable.map(normalize);
  let score = code === keyword ? 120 : code.includes(keyword) ? 40 : 0;
  if (title.includes(keyword)) score += 60;
  for (const term of terms) {
    if (title.includes(term)) score += 24;
    if (searchable.some((value) => value.includes(term))) score += 8;
  }
  return score;
}

function highlights(candidate: Candidate, terms: string[]) {
  return candidate.searchable
    .filter((value) => terms.some((term) => normalize(value).includes(term)))
    .filter((value, index, values) => values.indexOf(value) === index)
    .slice(0, 3);
}

function reviewCandidate(review: EventReview): Candidate {
  return {
    id: review.id,
    type: 'event_review',
    code: review.reviewCode,
    title: review.eventTitle,
    summary: review.lesson || review.summary,
    searchable: [
      review.summary,
      review.directCause,
      review.rootCause,
      review.lesson,
      ...review.actions.map((item) => item.title),
    ],
    areaId: review.areaId,
    areaName: review.areaName,
    status: review.status,
    updatedAt: review.updatedAt,
  };
}

function hazardCandidate(hazard: Hazard): Candidate {
  return {
    id: hazard.id,
    type: 'hazard',
    code: hazard.code,
    title: hazard.title,
    summary: hazard.acceptanceOpinion || hazard.description,
    searchable: [
      hazard.category,
      hazard.description,
      ...hazard.measures,
      hazard.acceptanceOpinion || '',
    ],
    areaId: hazard.areaId,
    areaName: hazard.areaName,
    status: hazard.status,
    updatedAt: hazard.updatedAt,
  };
}

function planCandidate(plan: EmergencyPlan): Candidate {
  const completedDrills = plan.drills.filter((item) => item.status === '已完成');
  return {
    id: plan.id,
    type: 'emergency_plan',
    code: plan.code,
    title: plan.name,
    summary: `${plan.eventType} · ${plan.applicableArea} · ${plan.responseLevel}`,
    searchable: [
      plan.category,
      plan.eventType,
      plan.applicableArea,
      plan.medium,
      plan.triggerRule,
      ...plan.notificationTargets,
      ...plan.steps,
      ...plan.resources,
      ...completedDrills.flatMap((item) => [item.summary || '', ...(item.issues || [])]),
    ],
    status: `${plan.publishStatus}/${plan.status}`,
    updatedAt: plan.updatedAt,
  };
}

function publicItem(item: Candidate & Pick<KnowledgeSearchItem, 'score' | 'highlights'>) {
  return {
    id: item.id,
    type: item.type,
    code: item.code,
    title: item.title,
    summary: item.summary,
    highlights: item.highlights,
    areaId: item.areaId,
    areaName: item.areaName,
    status: item.status,
    updatedAt: item.updatedAt,
    score: item.score,
  };
}

export class KnowledgeService {
  constructor(
    private readonly reviews: EventReviewService,
    private readonly hazards: HazardService,
    private readonly plans: EmergencyPlanService,
  ) {}

  async search(
    query: KnowledgeQueryDto,
    allowedAreaIds?: string[],
  ): Promise<KnowledgeSearchResult> {
    const keyword = normalize(query.keyword);
    const terms = searchTerms(keyword);
    const [reviews, hazards, plans] = await Promise.all([
      this.reviews.list(allowedAreaIds),
      this.hazards.list({}, allowedAreaIds),
      this.plans.list(),
    ]);
    const candidates: Candidate[] = [
      ...reviews.filter((item) => item.status === '已复盘').map(reviewCandidate),
      ...hazards.filter((item) => item.status === '已关闭').map(hazardCandidate),
      ...plans
        .filter((item) => item.publishStatus === '已发布' && item.status === '生效中')
        .map(planCandidate),
    ].filter((item) => !query.type || item.type === query.type);
    const ranked = candidates
      .map((candidate) => ({
        ...candidate,
        score: scoreCandidate(candidate, keyword, terms),
        highlights: highlights(candidate, terms),
      }))
      .filter((item) => item.score > 0)
      .sort(
        (left, right) =>
          right.score - left.score ||
          right.updatedAt.localeCompare(left.updatedAt) ||
          left.code.localeCompare(right.code),
      );
    const { limit = 10 } = query;
    return {
      keyword: query.keyword.trim(),
      total: ranked.length,
      items: ranked.slice(0, limit).map(publicItem),
    };
  }
}
