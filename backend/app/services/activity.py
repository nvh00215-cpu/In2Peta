"""Activity logging + streak computation."""
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ActivityLog


async def log_activity(db: AsyncSession, user_id: int, event_type: str, payload: dict | None = None) -> None:
    db.add(ActivityLog(user_id=user_id, event_type=event_type, payload=payload or {}))


async def compute_streak(db: AsyncSession, user_id: int) -> int:
    """Consecutive days (ending today or yesterday) with at least one activity event."""
    rows = (
        await db.execute(
            select(ActivityLog.created_at)
            .where(ActivityLog.user_id == user_id)
            .order_by(ActivityLog.created_at.desc())
            .limit(2000)
        )
    ).scalars().all()
    if not rows:
        return 0
    days: set[date] = set()
    for ts in rows:
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        days.add(ts.astimezone(timezone.utc).date())

    today = datetime.now(timezone.utc).date()
    anchor = today if today in days else today - timedelta(days=1)
    if anchor not in days:
        return 0
    streak = 0
    cursor = anchor
    while cursor in days:
        streak += 1
        cursor -= timedelta(days=1)
    return streak
