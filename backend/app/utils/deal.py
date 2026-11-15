"""
Helpers for deal fields (value / period)
"""
from typing import Optional

from app.models.contact import DealPeriod

PERIOD_LABELS = {
    DealPeriod.MONTHLY: "month",
    DealPeriod.YEARLY: "year",
    DealPeriod.ONE_TIME: "one-time",
}


def apply_deal_defaults(entity) -> None:
    """Keep value and period consistent: a value needs a period (default monthly), no value means no period."""
    if entity.deal_value is None:
        entity.deal_value_period = None
    elif entity.deal_value_period is None:
        entity.deal_value_period = DealPeriod.MONTHLY


def format_deal_value(value: Optional[float], period: Optional[DealPeriod]) -> Optional[str]:
    """Croatian-style amount for emails, e.g. "1.234,50 EUR / month"."""
    if value is None:
        return None
    text = f"{value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    if text.endswith(",00"):
        text = text[:-3]
    label = PERIOD_LABELS.get(period) if period else None
    if label == "one-time":
        return f"{text} EUR (one-time)"
    return f"{text} EUR / {label}" if label else f"{text} EUR"
