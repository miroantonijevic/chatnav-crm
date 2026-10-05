"""
Dashboard activity schemas
"""
from typing import List
from pydantic import BaseModel


class ActivityByDay(BaseModel):
    date: str
    count: int


class ActivityByUser(BaseModel):
    user_id: int
    user_name: str
    created: int
    edited: int
    interactions: int
    total: int
    by_day: List[ActivityByDay]


class ActivityStatsResponse(BaseModel):
    days: int
    by_user: List[ActivityByUser]
    by_day: List[ActivityByDay]
