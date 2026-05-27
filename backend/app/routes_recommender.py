from typing import List, Optional
from fastapi import APIRouter
from pydantic import BaseModel, Field

from . import recommender


router = APIRouter(prefix="/api/recommender", tags=["recommender"])


class CustomerProfile(BaseModel):
    name: Optional[str] = None
    age: int = Field(..., ge=0, le=120)
    gender: str  # "laki-laki" | "perempuan"
    marital: Optional[str] = None  # "lajang" | "menikah" | "cerai" | "janda/duda"
    dependents: Optional[int] = Field(default=None, ge=0, le=20)
    income_per_month: Optional[float] = Field(default=None, ge=0, description="in millions IDR")
    health_notes: Optional[str] = None
    budget_premium_per_month: Optional[float] = Field(default=None, ge=0, description="in millions IDR")
    goal: Optional[str] = None  # "proteksi keluarga" | "legacy planning" | etc
    horizon_years: Optional[int] = Field(default=None, ge=1, le=60)
    notes: Optional[str] = None


class Recommendation(BaseModel):
    product_name: str
    fit_score: int
    suggested_up: str
    suggested_premium: str
    suggested_tenor: str
    rationale: List[str]
    concerns: List[str]


class RecommendationResponse(BaseModel):
    customer_summary: str
    recommendations: List[Recommendation]
    error: Optional[str] = None
    raw: Optional[str] = None
    profile_echo: Optional[dict] = None


@router.post("/recommend", response_model=RecommendationResponse)
def recommend(profile: CustomerProfile):
    return recommender.recommend(profile.model_dump(exclude_none=False))
