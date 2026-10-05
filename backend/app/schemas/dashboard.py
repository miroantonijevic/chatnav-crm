"""
Dashboard activity schemas
"""
from typing import List
from pydantic import BaseModel


class ActivityByUser(BaseModel):
    user_id: int
    user_name: str
    created: int
    edited: int
    interactions: int
    total: int


class ActivityByDay(BaseModel):
    date: str
    count: int


class ActivityStatsResponse(BaseModel):
    days: int
    by_user: List[ActivityByUser]
    by_day: List[ActivityByDay]
