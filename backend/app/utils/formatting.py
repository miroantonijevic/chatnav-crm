"""
Utility functions for formatting and helpers
"""
from datetime import datetime
from typing import Optional


def format_datetime(dt: Optional[datetime], format_string: str = "%Y-%m-%d %H:%M:%S") -> str:
    """Format datetime object to string"""
    if dt is None:
        return ""
    return dt.strftime(format_string)


def parse_datetime(date_string: str) -> Optional[datetime]:
    """Parse datetime string to datetime object"""
    if not date_string:
        return None

    try:
        return datetime.fromisoformat(date_string.replace('Z', '+00:00'))
    except ValueError:
        return None
