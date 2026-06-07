"""Assessment rule settings (Admin / Super Admin)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.assessment import AssessmentConfig, AssessmentRule, AssessmentRuleType
from app.models.user import User
from app.schemas.assessment import (
    AssessmentConfigRead,
    AssessmentConfigUpdate,
    AssessmentRuleCreate,
    AssessmentRuleRead,
    AssessmentRuleUpdate,
)

router = APIRouter()
ADMIN_ROLES = ("Super Admin", "Admin")


async def _get_config(db: AsyncSession) -> AssessmentConfig:
    config = (await db.execute(select(AssessmentConfig).limit(1))).scalar_one_or_none()
    if config is None:
        config = AssessmentConfig(pass_threshold=80, version=1)
        db.add(config)
        await db.flush()
    return config


def _validate_weighted_sum(rules: list[AssessmentRule]) -> None:
    active_weighted = [r for r in rules if r.is_active and r.rule_type == AssessmentRuleType.WEIGHTED.value]
    total = sum(r.weight or 0 for r in active_weighted)
    if active_weighted and total != 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Active weighted rule weights must sum to 100 (current: {total})",
        )


@router.get("/config", response_model=AssessmentConfigRead)
async def get_assessment_config(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> AssessmentConfigRead:
    return AssessmentConfigRead.model_validate(await _get_config(db))


@router.put("/config", response_model=AssessmentConfigRead)
async def update_assessment_config(
    payload: AssessmentConfigUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(ADMIN_ROLES)),
) -> AssessmentConfigRead:
    config = await _get_config(db)
    config.pass_threshold = payload.pass_threshold
    config.version += 1
    config.updated_by = current_user.id
    await db.commit()
    await db.refresh(config)
    return AssessmentConfigRead.model_validate(config)


@router.get("/rules", response_model=list[AssessmentRuleRead])
async def list_assessment_rules(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[AssessmentRuleRead]:
    rules = (
        await db.execute(select(AssessmentRule).order_by(AssessmentRule.sort_order, AssessmentRule.id))
    ).scalars().all()
    return [AssessmentRuleRead.model_validate(r) for r in rules]


@router.post("/rules", response_model=AssessmentRuleRead, status_code=status.HTTP_201_CREATED)
async def create_assessment_rule(
    payload: AssessmentRuleCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(ADMIN_ROLES)),
) -> AssessmentRuleRead:
    existing = (
        await db.execute(select(AssessmentRule).where(AssessmentRule.rule_key == payload.rule_key))
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status_code=400, detail="Rule key already exists")

    if payload.rule_type == AssessmentRuleType.VETO.value:
        payload_weight = None
    else:
        payload_weight = payload.weight
        if payload_weight is None:
            raise HTTPException(status_code=400, detail="Weighted rules require weight")

    row = AssessmentRule(
        rule_key=payload.rule_key,
        display_name=payload.display_name,
        rule_type=payload.rule_type,
        weight=payload_weight,
        params=payload.params,
        failure_message=payload.failure_message,
        is_active=payload.is_active,
        sort_order=payload.sort_order,
    )
    db.add(row)
    await db.flush()

    all_rules = (await db.execute(select(AssessmentRule))).scalars().all()
    _validate_weighted_sum(list(all_rules))

    config = await _get_config(db)
    config.version += 1
    await db.commit()
    await db.refresh(row)
    return AssessmentRuleRead.model_validate(row)


@router.patch("/rules/{rule_id}", response_model=AssessmentRuleRead)
async def update_assessment_rule(
    rule_id: int,
    payload: AssessmentRuleUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(ADMIN_ROLES)),
) -> AssessmentRuleRead:
    row = (
        await db.execute(select(AssessmentRule).where(AssessmentRule.id == rule_id))
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Rule not found")

    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(row, key, value)

    if row.rule_type == AssessmentRuleType.VETO.value:
        row.weight = None
    elif row.weight is None:
        raise HTTPException(status_code=400, detail="Weighted rules require weight")

    await db.flush()
    all_rules = (await db.execute(select(AssessmentRule))).scalars().all()
    _validate_weighted_sum(list(all_rules))

    config = await _get_config(db)
    config.version += 1
    await db.commit()
    await db.refresh(row)
    return AssessmentRuleRead.model_validate(row)


@router.delete("/rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_assessment_rule(
    rule_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(ADMIN_ROLES)),
) -> Response:
    row = (
        await db.execute(select(AssessmentRule).where(AssessmentRule.id == rule_id))
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Rule not found")
    await db.delete(row)
    config = await _get_config(db)
    config.version += 1
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
