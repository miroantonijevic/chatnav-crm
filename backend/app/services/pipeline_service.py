"""
Pipeline ("hot list") service.

Presents companies and contacts that have a priority set (or that the current user
has starred) as one list. Filtering, searching, sorting and pagination all happen
in SQL over a UNION of both tables, so pagination never hides rows from
filters/search and `total` is always exact.
"""
from dataclasses import dataclass, field, replace
from datetime import datetime, timedelta
from typing import List, Optional, Set, Tuple

from fastapi import HTTPException, status as http_status
from sqlalchemy import String, and_, asc, case, desc, exists, func, literal_column, or_, select, union_all
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased, joinedload

from app.models.company import Company
from app.models.contact import Contact, DealPeriod, DealStage, Priority, RelationshipStatus, WaitingOn
from app.models.favorite import UserFavorite
from app.models.user import User
from app.schemas.pipeline import PipelineItem, PipelineSummary, PipelineUpdate
from app.services.company_history_service import CompanyHistoryService
from app.services.company_service import CompanyService
from app.services.contact_service import ContactService
from app.services.history_service import HistoryService
from app.utils.deal import apply_deal_defaults, format_deal_value


@dataclass
class PipelineFilters:
    search: Optional[str] = None
    entity_type: Optional[str] = None  # "company" | "contact" | None (both)
    priorities: List[Priority] = field(default_factory=list)
    status: Optional[RelationshipStatus] = None
    owner_id: Optional[int] = None
    due: Optional[str] = None  # "overdue" | "week" | "none"
    stage: Optional[DealStage] = None
    waiting_on: Optional[WaitingOn] = None
    favorites_only: bool = False
    user_id: Optional[int] = None  # current user, for favourites


# ---------- SQL expression helpers ----------

def _rank(col):
    """Sort rank for priority: hot < warm < cold < (none)"""
    return case(
        (col == Priority.HOT, 0),
        (col == Priority.WARM, 1),
        (col == Priority.COLD, 2),
        else_=3,
    )


def _stage_rank(col):
    return case(*[(col == s, i) for i, s in enumerate(DealStage)], else_=99)


def _mrr(value, period):
    """Monthly-equivalent recurring value; one-time and empty values count as 0"""
    return case(
        (value.is_(None), 0.0),
        (period == DealPeriod.YEARLY, value / 12.0),
        (period == DealPeriod.ONE_TIME, 0.0),
        else_=value,
    )


def _one_time(value, period):
    return case((and_(value.isnot(None), period == DealPeriod.ONE_TIME), value), else_=0.0)


def _nulls_last(col):
    return case((col.is_(None), 1), else_=0)


def _due_condition(col, due: Optional[str]) -> list:
    now = datetime.utcnow()
    if due == "overdue":
        return [col.isnot(None), col <= now]
    if due == "week":
        return [col.isnot(None), col > now, col <= now + timedelta(days=7)]
    if due == "none":
        return [col.is_(None)]
    return []


class PipelineService:

    # ---------- query building ----------

    @staticmethod
    def _common_conditions(model, kind: str, f: PipelineFilters, use_priority: bool, use_due: bool, scope: str) -> list:
        """
        scope: "pipeline" = items with a priority, "favorites" = items the user starred,
               "auto" = favourites when the favourites filter is on, otherwise pipeline.
        """
        favorites_scope = scope == "favorites" or (scope == "auto" and f.favorites_only)
        conditions = []

        if favorites_scope:
            conditions.append(
                exists().where(
                    UserFavorite.user_id == (f.user_id or -1),
                    UserFavorite.entity_type == kind,
                    UserFavorite.entity_id == model.id,
                )
            )
        if use_priority and f.priorities:
            conditions.append(model.priority.in_(f.priorities))
        elif not favorites_scope:
            # Pipeline scope: only items that have been given a priority
            conditions.append(model.priority.isnot(None))

        if f.status:
            conditions.append(model.current_relationship_status == f.status)
        if f.owner_id:
            conditions.append(model.owner_user_id == f.owner_id)
        if f.stage:
            conditions.append(model.deal_stage == f.stage)
        if f.waiting_on:
            conditions.append(model.waiting_on == f.waiting_on)
        if use_due:
            conditions.extend(_due_condition(model.next_contact_due_at, f.due))
        return conditions

    @staticmethod
    def _columns(kind: str, model, name_expr, owner):
        return [
            literal_column(f"'{kind}'", String).label("entity_type"),
            model.id.label("id"),
            func.lower(name_expr).label("name_key"),
            model.priority.label("priority"),
            _rank(model.priority).label("rank"),
            model.current_relationship_status.label("status"),
            model.last_contacted_at.label("last_contacted_at"),
            model.next_contact_due_at.label("due"),
            func.lower(owner.full_name).label("owner_key"),
            model.updated_at.label("updated_at"),
            model.deal_value.label("deal_value"),
            model.deal_stage.label("deal_stage"),
            _stage_rank(model.deal_stage).label("stage_rank"),
            _mrr(model.deal_value, model.deal_value_period).label("mrr"),
            _one_time(model.deal_value, model.deal_value_period).label("one_time_amt"),
        ]

    @classmethod
    def _company_select(cls, f, use_priority, use_due, scope):
        owner = aliased(User)
        conditions = [
            *CompanyService._filter_conditions(search=f.search),
            *cls._common_conditions(Company, "company", f, use_priority, use_due, scope),
        ]
        return (
            select(*cls._columns("company", Company, Company.name, owner))
            .select_from(Company)
            .outerjoin(owner, owner.id == Company.owner_user_id)
            .where(*conditions)
        )

    @classmethod
    def _contact_select(cls, f, use_priority, use_due, scope):
        owner = aliased(User)
        conditions = [
            *ContactService._filter_conditions(search=f.search),
            *cls._common_conditions(Contact, "contact", f, use_priority, use_due, scope),
        ]
        return (
            select(*cls._columns("contact", Contact, Contact.first_name + " " + Contact.last_name, owner))
            .select_from(Contact)
            .outerjoin(owner, owner.id == Contact.owner_user_id)
            .where(*conditions)
        )

    @classmethod
    def _union(cls, f: PipelineFilters, use_priority: bool = True, use_due: bool = True, scope: str = "auto"):
        selects = []
        if f.entity_type in (None, "company"):
            selects.append(cls._company_select(f, use_priority, use_due, scope))
        if f.entity_type in (None, "contact"):
            selects.append(cls._contact_select(f, use_priority, use_due, scope))
        return (selects[0] if len(selects) == 1 else union_all(*selects)).subquery()

    @staticmethod
    def _order_by(sub, sort_by: Optional[str], sort_order: str) -> list:
        direction = desc if sort_order == "desc" else asc
        c = sub.c
        # Stable tiebreakers keep pagination deterministic
        tie = [asc(c.entity_type), asc(c.id)]

        if sort_by == "due":
            return [asc(_nulls_last(c.due)), direction(c.due), asc(c.rank), *tie]
        if sort_by == "last_contacted":
            return [asc(_nulls_last(c.last_contacted_at)), direction(c.last_contacted_at), asc(c.rank), *tie]
        if sort_by == "name":
            return [direction(c.name_key), *tie]
        if sort_by == "status":
            return [direction(c.status), asc(c.rank), *tie]
        if sort_by == "owner":
            return [direction(c.owner_key), asc(c.rank), *tie]
        if sort_by == "updated":
            return [direction(c.updated_at), *tie]
        if sort_by == "value":
            return [asc(_nulls_last(c.deal_value)), direction(c.mrr), asc(c.rank), *tie]
        if sort_by == "stage":
            return [asc(_nulls_last(c.deal_stage)), direction(c.stage_rank), asc(c.rank), *tie]
        # default / "priority": hottest first, then most urgent follow-up
        return [direction(c.rank), asc(_nulls_last(c.due)), asc(c.due), asc(c.name_key), *tie]

    # ---------- reads ----------

    @classmethod
    async def list_items(
        cls,
        db: AsyncSession,
        f: PipelineFilters,
        skip: int = 0,
        limit: int = 50,
        sort_by: Optional[str] = None,
        sort_order: str = "asc",
    ) -> Tuple[List[PipelineItem], int]:
        sub = cls._union(f)

        total = (await db.execute(select(func.count()).select_from(sub))).scalar_one()

        rows = (
            await db.execute(
                select(sub.c.entity_type, sub.c.id)
                .order_by(*cls._order_by(sub, sort_by, sort_order))
                .offset(skip)
                .limit(limit)
            )
        ).all()

        company_ids = [r.id for r in rows if r.entity_type == "company"]
        contact_ids = [r.id for r in rows if r.entity_type == "contact"]

        companies = {c.id: c for c in await cls._load_companies(db, company_ids)} if company_ids else {}
        contacts = {c.id: c for c in await cls._load_contacts(db, contact_ids)} if contact_ids else {}
        favorites = await cls._favorite_set(db, f.user_id, company_ids, contact_ids)

        items: List[PipelineItem] = []
        for r in rows:
            entity = (companies if r.entity_type == "company" else contacts).get(r.id)
            if entity is not None:
                items.append(cls.to_item(r.entity_type, entity, (r.entity_type, r.id) in favorites))
        return items, total

    @staticmethod
    async def _favorite_set(
        db: AsyncSession, user_id: Optional[int], company_ids: List[int], contact_ids: List[int]
    ) -> Set[Tuple[str, int]]:
        if not user_id or not (company_ids or contact_ids):
            return set()
        clauses = []
        if company_ids:
            clauses.append(and_(UserFavorite.entity_type == "company", UserFavorite.entity_id.in_(company_ids)))
        if contact_ids:
            clauses.append(and_(UserFavorite.entity_type == "contact", UserFavorite.entity_id.in_(contact_ids)))
        result = await db.execute(
            select(UserFavorite.entity_type, UserFavorite.entity_id).where(
                UserFavorite.user_id == user_id, or_(*clauses)
            )
        )
        return {(t, i) for t, i in result.all()}

    @staticmethod
    async def _load_companies(db: AsyncSession, ids: List[int]) -> List[Company]:
        result = await db.execute(
            select(Company)
            .options(joinedload(Company.owner), joinedload(Company.contact_details))
            .where(Company.id.in_(ids))
        )
        return list(result.unique().scalars().all())

    @staticmethod
    async def _load_contacts(db: AsyncSession, ids: List[int]) -> List[Contact]:
        result = await db.execute(
            select(Contact)
            .options(
                joinedload(Contact.owner),
                joinedload(Contact.company),
                joinedload(Contact.contact_details),
            )
            .where(Contact.id.in_(ids))
        )
        return list(result.unique().scalars().all())

    @classmethod
    async def get_summary(cls, db: AsyncSession, f: PipelineFilters) -> PipelineSummary:
        """
        Counts and values for the filter tiles. Respects search/type/owner/status/stage but
        ignores the priority, due and favourites filters, so the tiles stay meaningful
        while one of those is selected.
        """
        sub = cls._union(f, use_priority=False, use_due=False, scope="pipeline")

        by_priority = (
            await db.execute(
                select(sub.c.priority, func.count(), func.coalesce(func.sum(sub.c.mrr), 0.0)).group_by(sub.c.priority)
            )
        ).all()
        one_time = (await db.execute(select(func.coalesce(func.sum(sub.c.one_time_amt), 0.0)))).scalar_one()
        overdue = (
            await db.execute(
                select(func.count()).select_from(sub).where(sub.c.due.isnot(None), sub.c.due <= datetime.utcnow())
            )
        ).scalar_one()

        # Type counts ignore the entity_type filter so the type switcher can show both numbers
        type_sub = cls._union(replace(f, entity_type=None), use_priority=False, use_due=False, scope="pipeline")
        by_type = (
            await db.execute(select(type_sub.c.entity_type, func.count()).group_by(type_sub.c.entity_type))
        ).all()

        favorites = 0
        if f.user_id:
            fav_sub = cls._union(f, use_priority=False, use_due=False, scope="favorites")
            favorites = (await db.execute(select(func.count()).select_from(fav_sub))).scalar_one()

        summary = PipelineSummary(overdue=overdue, favorites=favorites, one_time=float(one_time or 0))
        for p, n, mrr in by_priority:
            key = (p.name if isinstance(p, Priority) else str(p)).lower()
            if key in ("hot", "warm", "cold"):
                setattr(summary, key, n)
                setattr(summary, f"{key}_mrr", float(mrr or 0))
        for t, n in by_type:
            setattr(summary, "companies" if t == "company" else "contacts", n)
        summary.total = summary.hot + summary.warm + summary.cold
        summary.mrr = summary.hot_mrr + summary.warm_mrr + summary.cold_mrr
        return summary

    # ---------- mapping ----------

    @staticmethod
    def to_item(entity_type: str, e, is_favorite: bool = False) -> PipelineItem:
        owner_name = e.owner.full_name if getattr(e, "owner", None) else ""
        details = e.contact_details or []

        def values(kind: str) -> List[str]:
            return [d.value for d in details if d.type == kind and d.value]

        common = dict(
            id=e.id,
            priority=e.priority,
            next_action=e.next_action,
            deal_value=e.deal_value,
            deal_value_period=e.deal_value_period,
            deal_stage=e.deal_stage,
            waiting_on=e.waiting_on,
            is_favorite=is_favorite,
            status=e.current_relationship_status,
            last_contacted_at=e.last_contacted_at,
            next_contact_due_at=e.next_contact_due_at,
            reminders_enabled=e.reminders_enabled,
            owner_user_id=e.owner_user_id,
            owner_full_name=owner_name,
            updated_at=e.updated_at,
        )

        if entity_type == "company":
            return PipelineItem(
                entity_type="company",
                name=e.name,
                industry=e.industry,
                emails=values("email"),
                phones=values("phone"),
                **common,
            )

        emails = values("email")
        if e.email and e.email not in emails:
            emails.insert(0, e.email)
        phones = values("phone")
        if e.phone and e.phone not in phones:
            phones.insert(0, e.phone)
        return PipelineItem(
            entity_type="contact",
            name=f"{e.first_name} {e.last_name}".strip(),
            company_id=e.company_id,
            company_name=e.company.name if getattr(e, "company", None) else None,
            job_title=e.job_title,
            emails=emails,
            phones=phones,
            **common,
        )

    # ---------- single item ----------

    @classmethod
    async def _get_entity(cls, db: AsyncSession, entity_type: str, entity_id: int, user: User):
        if entity_type == "company":
            entity = await CompanyService.get_by_id(db, entity_id, user)
        else:
            entity = await ContactService.get_by_id(db, entity_id, user)
        if not entity:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail=f"{entity_type.capitalize()} not found",
            )
        return entity

    @classmethod
    async def _reload_item(cls, db: AsyncSession, entity_type: str, entity_id: int, user: User) -> PipelineItem:
        if entity_type == "company":
            reloaded = (await cls._load_companies(db, [entity_id]))[0]
            favs = await cls._favorite_set(db, user.id, [entity_id], [])
        else:
            reloaded = (await cls._load_contacts(db, [entity_id]))[0]
            favs = await cls._favorite_set(db, user.id, [], [entity_id])
        return cls.to_item(entity_type, reloaded, (entity_type, entity_id) in favs)

    @classmethod
    async def get_item(cls, db: AsyncSession, entity_type: str, entity_id: int, user: User) -> PipelineItem:
        await cls._get_entity(db, entity_type, entity_id, user)
        return await cls._reload_item(db, entity_type, entity_id, user)

    # ---------- writes ----------

    @classmethod
    async def update_item(
        cls,
        db: AsyncSession,
        entity_type: str,
        entity_id: int,
        data: PipelineUpdate,
        user: User,
    ) -> PipelineItem:
        """Inline edit of priority / next action / follow-up / deal fields, with a history entry"""
        entity = await cls._get_entity(db, entity_type, entity_id, user)

        fields = data.model_fields_set
        changes: List[str] = []

        if "priority" in fields and data.priority != entity.priority:
            old = entity.priority.value if entity.priority else "none"
            new = data.priority.value if data.priority else "none"
            changes.append(f"Priority: {old} -> {new}")
            entity.priority = data.priority

        if "next_action" in fields:
            new_action = (data.next_action or "").strip() or None
            if new_action != entity.next_action:
                changes.append(f"Next action: {new_action}" if new_action else "Next action cleared")
                entity.next_action = new_action

        if "next_contact_due_at" in fields and data.next_contact_due_at != entity.next_contact_due_at:
            changes.append(
                "Follow-up date cleared"
                if data.next_contact_due_at is None
                else f"Follow-up date set to {data.next_contact_due_at.strftime('%d.%m.%Y. %H:%M')}"
            )
            entity.next_contact_due_at = data.next_contact_due_at

        if "deal_stage" in fields and data.deal_stage != entity.deal_stage:
            old = entity.deal_stage.value if entity.deal_stage else "none"
            new = data.deal_stage.value if data.deal_stage else "none"
            changes.append(f"Stage: {old} -> {new}")
            entity.deal_stage = data.deal_stage

        if "waiting_on" in fields and data.waiting_on != entity.waiting_on:
            changes.append(f"Waiting on: {data.waiting_on.value}" if data.waiting_on else "Waiting on cleared")
            entity.waiting_on = data.waiting_on

        if "deal_value" in fields or "deal_value_period" in fields:
            before = (entity.deal_value, entity.deal_value_period)
            if "deal_value" in fields:
                entity.deal_value = data.deal_value
            if "deal_value_period" in fields and data.deal_value_period is not None:
                entity.deal_value_period = data.deal_value_period
            apply_deal_defaults(entity)
            if (entity.deal_value, entity.deal_value_period) != before:
                text = format_deal_value(entity.deal_value, entity.deal_value_period)
                changes.append(f"Deal value: {text}" if text else "Deal value cleared")

        if changes:
            note = "; ".join(changes)
            if entity_type == "company":
                CompanyHistoryService.add_system_event(
                    db, company_id=entity.id, entry_type="edited",
                    status=entity.current_relationship_status, user_id=user.id, note=note,
                )
            else:
                HistoryService.add_system_event(
                    db, contact_id=entity.id, entry_type="edited",
                    status=entity.current_relationship_status, user_id=user.id, note=note,
                )
            await db.commit()

        return await cls._reload_item(db, entity_type, entity_id, user)

    @classmethod
    async def set_favorite(
        cls, db: AsyncSession, entity_type: str, entity_id: int, user: User, favorite: bool
    ) -> PipelineItem:
        """Star / un-star an item for the current user (idempotent)"""
        await cls._get_entity(db, entity_type, entity_id, user)
        existing = (
            await db.execute(
                select(UserFavorite).where(
                    UserFavorite.user_id == user.id,
                    UserFavorite.entity_type == entity_type,
                    UserFavorite.entity_id == entity_id,
                )
            )
        ).scalar_one_or_none()

        if favorite and existing is None:
            db.add(UserFavorite(user_id=user.id, entity_type=entity_type, entity_id=entity_id))
            await db.commit()
        elif not favorite and existing is not None:
            await db.delete(existing)
            await db.commit()

        return await cls._reload_item(db, entity_type, entity_id, user)
