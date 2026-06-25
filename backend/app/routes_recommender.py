from typing import List, Literal, Optional
from fastapi import APIRouter
from pydantic import BaseModel, Field, model_validator

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
    horizon_years: Optional[int] = Field(default=None, ge=1)
    notes: Optional[str] = None

    @model_validator(mode="after")
    def clamp_horizon(self):
        max_h = 100 - self.age
        if self.horizon_years is not None and self.horizon_years > max_h:
            self.horizon_years = max(1, max_h)
        return self


class BCARecommendation(BaseModel):
    product_name: str
    fit_score: int
    suggested_up: str
    suggested_premium: str
    suggested_tenor: str
    rationale: List[str]
    concerns: List[str]


class CompetitorComparison(BaseModel):
    provider: str
    product_name: str
    similar_to: str
    fit_score: int
    strengths: List[str]
    weaknesses_vs_bca: List[str]


class ObjectionHandling(BaseModel):
    objection: str
    response: str


class SalesScript(BaseModel):
    best_product: str
    opening: str
    discovery_questions: List[str]
    pitch: str
    competitive_advantages: List[str]
    objection_handling: List[ObjectionHandling]
    closing: str


class RecommendationResponse(BaseModel):
    customer_summary: str
    bca_recommendations: List[BCARecommendation] = []
    competitor_comparisons: List[CompetitorComparison] = []
    sales_script: Optional[SalesScript] = None
    error: Optional[str] = None
    raw: Optional[str] = None
    profile_echo: Optional[dict] = None


@router.post("/recommend", response_model=RecommendationResponse)
def recommend(profile: CustomerProfile):
    return recommender.recommend(profile.model_dump(exclude_none=False))


# ---------------------------------------------------------------------------
# Single-competitor comparison (head-to-head / complementary)
# ---------------------------------------------------------------------------


class CompetitorSource(BaseModel):
    id: str
    name: str
    label: str
    insurer: str


@router.get("/competitors", response_model=List[CompetitorSource])
def competitors():
    """Ingested competitor documents (RIPLAY/brosur) available to compare."""
    return recommender.list_competitor_sources()


class CompareRequest(BaseModel):
    competitor_id: str
    # The BCA Life side: pass its fact-sheet display name and/or file stem.
    bca_name: Optional[str] = None
    bca_stem: Optional[str] = None
    mode: Literal["auto", "head_to_head", "complementary"] = "auto"

    @model_validator(mode="after")
    def need_bca(self):
        if not (self.bca_name or self.bca_stem):
            raise ValueError("bca_name or bca_stem is required")
        return self


class SpecRow(BaseModel):
    dimension: str
    bca: str
    competitor: str
    advantage: Literal["bca", "competitor", "tie"]


class CompareSide(BaseModel):
    name: str
    provider: str = ""
    type: str = ""
    one_liner: str = ""


class ComplementInfo(BaseModel):
    narrative: str = ""
    how_bca_completes: List[str] = []
    gaps_competitor_leaves: List[str] = []


class CompareResponse(BaseModel):
    relationship: Optional[Literal["head_to_head", "complementary"]] = None
    relationship_reason: str = ""
    bca: Optional[CompareSide] = None
    competitor: Optional[CompareSide] = None
    spec_rows: List[SpecRow] = []
    bca_advantages: List[str] = []
    competitor_advantages: List[str] = []
    complement: Optional[ComplementInfo] = None
    talking_points: List[str] = []
    summary: str = ""
    competitor_source: Optional[dict] = None
    error: Optional[str] = None
    raw: Optional[str] = None


@router.post("/compare", response_model=CompareResponse)
def compare(req: CompareRequest):
    return recommender.compare(
        competitor_id=req.competitor_id,
        bca_name=req.bca_name or "",
        bca_stem=req.bca_stem or "",
        mode=req.mode,
    )
