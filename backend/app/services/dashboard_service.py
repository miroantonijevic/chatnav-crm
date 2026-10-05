"""
Dashboard activity statistics service
"""
from datetime import datetime, timedelta
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.relationship_history import RelationshipHistory
from app.models.company import CompanyHistory
from app.models.user import User

# "marked_contacted" (quick "Mark as contacted" action) counts as an interaction
ENTRY_TYPE_BUCKET = {
    "created": "created",
    "edited": "edited",
    "interaction": "interactions",
    "marked_contacted": "interactions",
}


class DashboardService:
    """Aggregates activity (created/edited/interaction) across contacts and companies"""

    @staticmethod
    def _build_day_range(days: int) -> list[str]:
        today = datetime.utcnow().date()
        return [(today - timedelta(days=i)).isoformat() for i in range(days - 1, -1, -1)]

    @staticmethod
    async def get_activity_stats(db: AsyncSession, days: int = 30) -> dict:
        cutoff = datetime.utcnow() - timedelta(days=days)
        day_range = DashboardService._build_day_range(days)

        contact_user_rows = await db.execute(
            select(
                RelationshipHistory.changed_by_user_id,
                RelationshipHistory.entry_type,
                func.count(),
            )
            .where(RelationshipHistory.created_at >= cutoff)
            .group_by(RelationshipHistory.changed_by_user_id, RelationshipHistory.entry_type)
        )
        company_user_rows = await db.execute(
            select(
                CompanyHistory.changed_by_user_id,
                CompanyHistory.entry_type,
                func.count(),
            )
            .where(CompanyHistory.created_at >= cutoff)
            .group_by(CompanyHistory.changed_by_user_id, CompanyHistory.entry_type)
        )

        user_counts: dict[int, dict[str, int]] = {}
        for user_id, entry_type, count in [*contact_user_rows.all(), *company_user_rows.all()]:
            bucket = user_counts.setdefault(user_id, {"created": 0, "edited": 0, "interactions": 0})
            key = ENTRY_TYPE_BUCKET.get(entry_type, entry_type)
            bucket[key] = bucket.get(key, 0) + count

        # Per-user, per-day counts (used to render one mini chart per user)
        contact_user_daily_rows = await db.execute(
            select(
                RelationshipHistory.changed_by_user_id,
                func.date(RelationshipHistory.created_at),
                func.count(),
            )
            .where(RelationshipHistory.created_at >= cutoff)
            .group_by(RelationshipHistory.changed_by_user_id, func.date(RelationshipHistory.created_at))
        )
        company_user_daily_rows = await db.execute(
            select(
                CompanyHistory.changed_by_user_id,
                func.date(CompanyHistory.created_at),
                func.count(),
            )
            .where(CompanyHistory.created_at >= cutoff)
            .group_by(CompanyHistory.changed_by_user_id, func.date(CompanyHistory.created_at))
        )

        user_daily_counts: dict[int, dict[str, int]] = {}
        for user_id, date_value, count in [*contact_user_daily_rows.all(), *company_user_daily_rows.all()]:
            daily_bucket = user_daily_counts.setdefault(user_id, {})
            key = str(date_value)
            daily_bucket[key] = daily_bucket.get(key, 0) + count

        users_result = await db.execute(select(User).where(User.id.in_(user_counts.keys())))
        users_by_id = {u.id: u for u in users_result.scalars().all()}

        by_user = []
        for user_id, counts in user_counts.items():
            user = users_by_id.get(user_id)
            total = counts["created"] + counts["edited"] + counts["interactions"]
            daily_bucket = user_daily_counts.get(user_id, {})
            by_user.append({
                "user_id": user_id,
                "user_name": user.full_name if user else "Unknown",
                "created": counts["created"],
                "edited": counts["edited"],
                "interactions": counts["interactions"],
                "total": total,
                "by_day": [{"date": d, "count": daily_bucket.get(d, 0)} for d in day_range],
            })
        by_user.sort(key=lambda u: u["total"], reverse=True)

        contact_daily_rows = await db.execute(
            select(func.date(RelationshipHistory.created_at), func.count())
            .where(RelationshipHistory.created_at >= cutoff)
            .group_by(func.date(RelationshipHistory.created_at))
        )
        company_daily_rows = await db.execute(
            select(func.date(CompanyHistory.created_at), func.count())
            .where(CompanyHistory.created_at >= cutoff)
            .group_by(func.date(CompanyHistory.created_at))
        )

        daily_counts: dict[str, int] = {}
        for date_value, count in [*contact_daily_rows.all(), *company_daily_rows.all()]:
            key = str(date_value)
            daily_counts[key] = daily_counts.get(key, 0) + count

        by_day = [{"date": d, "count": daily_counts.get(d, 0)} for d in day_range]

        return {"days": days, "by_user": by_user, "by_day": by_day}
