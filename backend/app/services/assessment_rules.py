"""Individual assessment rule evaluators."""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any

from sqlalchemy import and_, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.assessment import AssessmentRuleKey, AssessmentRuleType
from app.models.location import LocationHierarchy
from app.models.project import ProjectDetails, WorkflowStatus
from app.services.duplicate_detection import DuplicateMatch, find_duplicates


@dataclass
class RuleBreakdownItem:
    rule_key: str
    rule_type: str
    display_name: str
    weight: int | None
    earned: int
    max_points: int
    passed: bool
    message: str
    matches: list[dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        d: dict[str, Any] = {
            "rule_key": self.rule_key,
            "rule_type": self.rule_type,
            "display_name": self.display_name,
            "weight": self.weight,
            "earned": self.earned,
            "max": self.max_points,
            "passed": self.passed,
            "message": self.message,
        }
        if self.matches:
            d["matches"] = self.matches
        return d


def _match_dicts(matches: list[DuplicateMatch]) -> list[dict[str, Any]]:
    return [
        {
            "project_id": m.project_id,
            "project_code": m.project_code,
            "project_name": m.project_name,
            "reason": m.reason,
        }
        for m in matches
    ]


async def evaluate_duplicate_nearby(
    db: AsyncSession,
    project: ProjectDetails,
    *,
    display_name: str,
    failure_message: str,
    params: dict[str, Any],
) -> RuleBreakdownItem:
    radius = int(params.get("radius_meters", 50))
    matches = await find_duplicates(
        db,
        location_id=project.location_id,
        project_type_id=project.project_type_id,
        created_by=project.created_by,
        latitude=project.latitude,
        longitude=project.longitude,
        exclude_project_id=project.id,
        radius_meters=radius,
        project_group_id=project.project_group_id,
        parent_project_id=project.parent_project_id,
    )
    triggered = len(matches) > 0
    msg = failure_message
    if triggered:
        msg = f"{failure_message}: {matches[0].project_code} ({matches[0].reason})"
    return RuleBreakdownItem(
        rule_key=AssessmentRuleKey.DUPLICATE_NEARBY.value,
        rule_type=AssessmentRuleType.VETO.value,
        display_name=display_name,
        weight=None,
        earned=0,
        max_points=0,
        passed=not triggered,
        message=msg,
        matches=_match_dicts(matches),
    )


async def evaluate_geo_outside_union(
    db: AsyncSession,
    project: ProjectDetails,
    *,
    display_name: str,
    failure_message: str,
    params: dict[str, Any],
) -> RuleBreakdownItem:
    contains = (
        await db.execute(
            select(
                func.ST_Contains(
                    LocationHierarchy.bbx_polygon,
                    func.ST_SetSRID(
                        func.ST_MakePoint(float(project.longitude), float(project.latitude)),
                        4326,
                    ),
                )
            ).where(
                LocationHierarchy.id == project.location_id,
                LocationHierarchy.bbx_polygon.isnot(None),
            )
        )
    ).scalar_one_or_none()

    if contains is None:
        return RuleBreakdownItem(
            rule_key=AssessmentRuleKey.GEO_OUTSIDE_UNION.value,
            rule_type=AssessmentRuleType.VETO.value,
            display_name=display_name,
            weight=None,
            earned=0,
            max_points=0,
            passed=True,
            message="Union boundary not defined; geo check skipped",
        )

    outside = not contains
    return RuleBreakdownItem(
        rule_key=AssessmentRuleKey.GEO_OUTSIDE_UNION.value,
        rule_type=AssessmentRuleType.VETO.value,
        display_name=display_name,
        weight=None,
        earned=0,
        max_points=0,
        passed=not outside,
        message=failure_message if outside else "Coordinates within union boundary",
    )


async def evaluate_budget_over_cap(
    db: AsyncSession,
    project: ProjectDetails,
    *,
    display_name: str,
    failure_message: str,
    weight: int,
    params: dict[str, Any],
) -> RuleBreakdownItem:
    max_cost = Decimal(str(params.get("max_cost", 50_000_000)))
    cost = project.estimated_cost
    if cost is None:
        return RuleBreakdownItem(
            rule_key=AssessmentRuleKey.BUDGET_OVER_CAP.value,
            rule_type=AssessmentRuleType.WEIGHTED.value,
            display_name=display_name,
            weight=weight,
            earned=0,
            max_points=weight,
            passed=False,
            message="Estimated cost not provided",
        )
    if cost <= max_cost:
        return RuleBreakdownItem(
            rule_key=AssessmentRuleKey.BUDGET_OVER_CAP.value,
            rule_type=AssessmentRuleType.WEIGHTED.value,
            display_name=display_name,
            weight=weight,
            earned=weight,
            max_points=weight,
            passed=True,
            message=f"Estimated cost {cost} within cap {max_cost}",
        )
    return RuleBreakdownItem(
        rule_key=AssessmentRuleKey.BUDGET_OVER_CAP.value,
        rule_type=AssessmentRuleType.WEIGHTED.value,
        display_name=display_name,
        weight=weight,
        earned=0,
        max_points=weight,
        passed=False,
        message=f"{failure_message} (cap: {max_cost}, proposed: {cost})",
    )


async def evaluate_budget_vs_median(
    db: AsyncSession,
    project: ProjectDetails,
    *,
    display_name: str,
    failure_message: str,
    weight: int,
    params: dict[str, Any],
) -> RuleBreakdownItem:
    max_ratio = float(params.get("max_ratio", 2.0))
    cost = project.estimated_cost
    if cost is None:
        return RuleBreakdownItem(
            rule_key=AssessmentRuleKey.BUDGET_VS_MEDIAN.value,
            rule_type=AssessmentRuleType.WEIGHTED.value,
            display_name=display_name,
            weight=weight,
            earned=0,
            max_points=weight,
            passed=False,
            message="Estimated cost not provided",
        )

    median_val = (
        await db.execute(
            select(func.percentile_cont(0.5).within_group(ProjectDetails.estimated_cost)).where(
                ProjectDetails.location_id == project.location_id,
                ProjectDetails.project_type_id == project.project_type_id,
                ProjectDetails.workflow_status == WorkflowStatus.APPROVED.value,
                ProjectDetails.estimated_cost.isnot(None),
            )
        )
    ).scalar_one_or_none()

    if median_val is None:
        return RuleBreakdownItem(
            rule_key=AssessmentRuleKey.BUDGET_VS_MEDIAN.value,
            rule_type=AssessmentRuleType.WEIGHTED.value,
            display_name=display_name,
            weight=weight,
            earned=weight,
            max_points=weight,
            passed=True,
            message="No approved baseline in union; full points awarded",
        )

    median_dec = Decimal(str(median_val))
    ratio = float(cost / median_dec) if median_dec > 0 else 0.0
    if ratio <= max_ratio:
        return RuleBreakdownItem(
            rule_key=AssessmentRuleKey.BUDGET_VS_MEDIAN.value,
            rule_type=AssessmentRuleType.WEIGHTED.value,
            display_name=display_name,
            weight=weight,
            earned=weight,
            max_points=weight,
            passed=True,
            message=f"Cost ratio {ratio:.2f} within limit {max_ratio}",
        )
    partial = max(0, int(weight * (max_ratio / ratio)))
    return RuleBreakdownItem(
        rule_key=AssessmentRuleKey.BUDGET_VS_MEDIAN.value,
        rule_type=AssessmentRuleType.WEIGHTED.value,
        display_name=display_name,
        weight=weight,
        earned=partial,
        max_points=weight,
        passed=False,
        message=f"{failure_message} (ratio {ratio:.2f}, limit {max_ratio})",
    )


async def evaluate_pending_same_type(
    db: AsyncSession,
    project: ProjectDetails,
    *,
    display_name: str,
    failure_message: str,
    weight: int,
    params: dict[str, Any],
) -> RuleBreakdownItem:
    max_pending = int(params.get("max_pending", 3))
    pending_statuses = [
        WorkflowStatus.SUBMITTED.value,
        WorkflowStatus.UNDER_PIO_REVIEW.value,
        WorkflowStatus.FORWARDED_TO_UNO.value,
    ]
    count_stmt = select(func.count(ProjectDetails.id)).where(
        ProjectDetails.location_id == project.location_id,
        ProjectDetails.project_type_id == project.project_type_id,
        ProjectDetails.workflow_status.in_(pending_statuses),
    )
    if project.id:
        count_stmt = count_stmt.where(ProjectDetails.id != project.id)
    pending_count = (await db.execute(count_stmt)).scalar_one()

    if pending_count <= max_pending:
        return RuleBreakdownItem(
            rule_key=AssessmentRuleKey.PENDING_SAME_TYPE.value,
            rule_type=AssessmentRuleType.WEIGHTED.value,
            display_name=display_name,
            weight=weight,
            earned=weight,
            max_points=weight,
            passed=True,
            message=f"{pending_count} pending application(s) in union (limit {max_pending})",
        )
    over = pending_count - max_pending
    earned = max(0, weight - over * 5)
    return RuleBreakdownItem(
        rule_key=AssessmentRuleKey.PENDING_SAME_TYPE.value,
        rule_type=AssessmentRuleType.WEIGHTED.value,
        display_name=display_name,
        weight=weight,
        earned=earned,
        max_points=weight,
        passed=earned == weight,
        message=f"{failure_message} ({pending_count} pending, limit {max_pending})",
    )


async def evaluate_description_complete(
    db: AsyncSession,
    project: ProjectDetails,
    *,
    display_name: str,
    failure_message: str,
    weight: int,
    params: dict[str, Any],
) -> RuleBreakdownItem:
    required = params.get("required_fields", ["current_situation", "development_status"])
    missing = []
    for field_name in required:
        value = getattr(project, field_name, None)
        if not value or not str(value).strip():
            missing.append(field_name)
    if not missing:
        return RuleBreakdownItem(
            rule_key=AssessmentRuleKey.DESCRIPTION_COMPLETE.value,
            rule_type=AssessmentRuleType.WEIGHTED.value,
            display_name=display_name,
            weight=weight,
            earned=weight,
            max_points=weight,
            passed=True,
            message="All required narrative fields provided",
        )
    per_field = weight / len(required) if required else weight
    earned = int(per_field * (len(required) - len(missing)))
    return RuleBreakdownItem(
        rule_key=AssessmentRuleKey.DESCRIPTION_COMPLETE.value,
        rule_type=AssessmentRuleType.WEIGHTED.value,
        display_name=display_name,
        weight=weight,
        earned=earned,
        max_points=weight,
        passed=len(missing) == 0,
        message=f"{failure_message}: missing {', '.join(missing)}",
    )


RULE_EVALUATORS = {
    AssessmentRuleKey.DUPLICATE_NEARBY.value: evaluate_duplicate_nearby,
    AssessmentRuleKey.GEO_OUTSIDE_UNION.value: evaluate_geo_outside_union,
    AssessmentRuleKey.BUDGET_OVER_CAP.value: evaluate_budget_over_cap,
    AssessmentRuleKey.BUDGET_VS_MEDIAN.value: evaluate_budget_vs_median,
    AssessmentRuleKey.PENDING_SAME_TYPE.value: evaluate_pending_same_type,
    AssessmentRuleKey.DESCRIPTION_COMPLETE.value: evaluate_description_complete,
}
