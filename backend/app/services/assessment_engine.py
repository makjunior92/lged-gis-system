"""Project assessment scoring engine."""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.assessment import AssessmentConfig, AssessmentRule, AssessmentRuleType, ProjectAssessment
from app.models.project import ProjectDetails
from app.services.assessment_rules import RULE_EVALUATORS, RuleBreakdownItem


@dataclass
class AssessmentResult:
    total_score: int
    passed: bool
    breakdown: list[RuleBreakdownItem]
    config_version: int


async def load_config(db: AsyncSession) -> AssessmentConfig:
    config = (await db.execute(select(AssessmentConfig).limit(1))).scalar_one_or_none()
    if config is None:
        config = AssessmentConfig(pass_threshold=80, version=1)
        db.add(config)
        await db.flush()
    return config


async def load_active_rules(db: AsyncSession) -> list[AssessmentRule]:
    stmt = (
        select(AssessmentRule)
        .where(AssessmentRule.is_active.is_(True))
        .order_by(AssessmentRule.sort_order, AssessmentRule.id)
    )
    return list((await db.execute(stmt)).scalars().all())


def sync_legacy_flags(project: ProjectDetails, breakdown: list[RuleBreakdownItem]) -> None:
    """Mirror assessment results onto legacy boolean columns."""
    dup = next(
        (b for b in breakdown if b.rule_key == "duplicate_nearby"),
        None,
    )
    if dup and not dup.passed:
        project.is_duplicate_flag = True
        project.duplicate_reason = dup.message
    else:
        project.is_duplicate_flag = False
        project.duplicate_reason = None

    budget = next(
        (b for b in breakdown if b.rule_key == "budget_over_cap"),
        None,
    )
    if budget and not budget.passed:
        project.is_impractical_budget_flag = True
        project.impractical_budget_reason = budget.message
    else:
        project.is_impractical_budget_flag = False
        project.impractical_budget_reason = None


async def evaluate_project(db: AsyncSession, project: ProjectDetails) -> AssessmentResult:
    config = await load_config(db)
    rules = await load_active_rules(db)
    breakdown: list[RuleBreakdownItem] = []

    for rule in rules:
        evaluator = RULE_EVALUATORS.get(rule.rule_key)
        if evaluator is None:
            continue

        kwargs: dict = {
            "display_name": rule.display_name,
            "failure_message": rule.failure_message,
            "params": rule.params or {},
        }
        if rule.rule_type == AssessmentRuleType.WEIGHTED.value:
            kwargs["weight"] = rule.weight or 0

        item = await evaluator(db, project, **kwargs)
        breakdown.append(item)

        if rule.rule_type == AssessmentRuleType.VETO.value and not item.passed:
            sync_legacy_flags(project, breakdown)
            return AssessmentResult(
                total_score=0,
                passed=False,
                breakdown=breakdown,
                config_version=config.version,
            )

    total = sum(b.earned for b in breakdown if b.rule_type == AssessmentRuleType.WEIGHTED.value)
    passed = total >= config.pass_threshold
    sync_legacy_flags(project, breakdown)
    return AssessmentResult(
        total_score=total,
        passed=passed,
        breakdown=breakdown,
        config_version=config.version,
    )


async def persist_assessment(
    db: AsyncSession,
    project: ProjectDetails,
    result: AssessmentResult,
) -> ProjectAssessment:
    row = ProjectAssessment(
        project_id=project.id,
        total_score=result.total_score,
        passed=result.passed,
        breakdown=[b.to_dict() for b in result.breakdown],
        config_version=result.config_version,
    )
    db.add(row)
    await db.flush()
    return row


async def evaluate_and_persist(db: AsyncSession, project: ProjectDetails) -> AssessmentResult:
    result = await evaluate_project(db, project)
    await persist_assessment(db, project, result)
    return result


async def get_latest_assessment(db: AsyncSession, project_id: int) -> ProjectAssessment | None:
    stmt = (
        select(ProjectAssessment)
        .where(ProjectAssessment.project_id == project_id)
        .order_by(ProjectAssessment.evaluated_at.desc(), ProjectAssessment.id.desc())
        .limit(1)
    )
    return (await db.execute(stmt)).scalar_one_or_none()
