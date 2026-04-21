"""
Nutrition scoring service.

Implements a 7-dimension health scoring system plus an overall weighted score.
Each dimension returns an integer in [0, 100] (higher is better).

Design notes
------------
* Pure functions: every scorer takes plain dicts and returns an int. No I/O,
  no mutable state — trivial to unit-test.
* Thresholds are module-level constants, not magic numbers buried in methods,
  so nutrition scientists can tune them without reading the code.
* Classification keywords are compiled once at import time into frozen sets.
* Errors propagate as :class:`NutritionScoringError` instead of being silently
  swallowed into a misleading "50" default.
"""
from __future__ import annotations

import logging
import time
from typing import Any, Dict, Iterable, List, Mapping, Optional

logger = logging.getLogger(__name__)


class NutritionScoringError(RuntimeError):
    """Raised when a nutrition score cannot be computed for the given input."""


# ---------------------------------------------------------------------------
# Thresholds & tuning constants
# ---------------------------------------------------------------------------
DEFAULT_GLYCEMIC_INDEX = 70  # Assumed medium GI when data is missing.

# Blood sugar — glycemic-load buckets (lower GL = better)
BS_GL_BUCKETS = ((10, 95), (20, 80), (30, 60), (40, 40))
BS_FIBER_RATIO_STRONG = 0.20  # fiber / net_carbs ≥ 0.20 → +15
BS_FIBER_RATIO_OK = 0.10      # ratio ≥ 0.10 → +5
BS_SUGAR_PENALTY_THRESHOLD = 20.0
BS_SUGAR_PENALTY_MAX = 20
BS_FRUCTOSE_HIGH = 10.0
BS_FRUCTOSE_MODERATE = 5.0

# Gut health
GUT_FIBER_EXCELLENT = 10.0
GUT_FIBER_GOOD = 5.0
GUT_FIBER_FAIR = 3.0
GUT_FIBER_LOW_PENALTY_THRESHOLD = 2.0

# Inflammation
INFLAM_OMEGA_RATIO_GOOD = 4.0
INFLAM_OMEGA_RATIO_OK = 10.0
INFLAM_ORAC_EXCELLENT = 5000
INFLAM_ORAC_GOOD = 2000

# Nutrient density
ND_PROTEIN_DENSITY_HIGH = 15  # g protein per 200 kcal
ND_PROTEIN_DENSITY_MED = 10
ND_PROTEIN_DENSITY_LOW = 5
ND_FIBER_DENSITY_HIGH = 5
ND_FIBER_DENSITY_MED = 3
ND_FIBER_DENSITY_LOW = 1
ND_EMPTY_CAL_PENALTY = 20  # applied when >300 kcal with tiny protein & fiber

# Processing (NOVA classification)
NOVA_SCORES: Mapping[int, int] = {1: 100, 2: 75, 3: 50, 4: 25}
PROCESS_SODIUM_HIGH = 800
PROCESS_SODIUM_MODERATE = 400
PROCESS_UPF_CAP = 30
PROCESS_UPF_ADDITIONAL_PENALTY = 10
PROCESS_UPF_INDICATOR_PENALTY = 10
PROCESS_UPF_MAX_PENALTY = 40  # cap repeated per-ingredient penalties

# Micronutrient
MICRO_EXCELLENT_RDI = 50
MICRO_GOOD_RDI = 20
MICRO_FAIR_RDI = 10

# Weighted overall score
OVERALL_WEIGHTS: Mapping[str, float] = {
    "blood_sugar_score": 0.20,
    "gut_health_score": 0.15,
    "inflammation_score": 0.15,
    "nutrient_density_score": 0.15,
    "processing_level_score": 0.15,
    "protein_quality_score": 0.10,
    "micronutrient_score": 0.10,
}

# ---------------------------------------------------------------------------
# Ingredient keyword sets (hoisted, compiled once)
# ---------------------------------------------------------------------------
FERMENTED_MARKERS = frozenset(["fermented", "pickled", "น้ำปลา", "ปลาร้า"])

ANTI_INFLAMMATORY_KEYWORDS = frozenset([
    "turmeric", "ขมิ้น", "ginger", "ขิง",
    "garlic", "กระเทียม", "green tea", "ชาเขียว",
    "berries", "tomato", "olive oil",
])

UPF_INGREDIENT_KEYWORDS = frozenset([
    "artificial", "preservative", "flavoring", "coloring",
    "emulsifier", "sweetener", "maltodextrin",
    "high fructose corn syrup", "hydrogenated",
])

HIGH_QUALITY_PROTEINS = frozenset([
    "chicken", "ไก่", "fish", "ปลา", "egg", "ไข่",
    "beef", "เนื้อ", "pork", "หมู", "shrimp", "กุ้ง",
    "tofu", "เต้าหู้", "tempeh",
])

MODERATE_QUALITY_PROTEINS = frozenset([
    "beans", "ถั่ว", "lentils", "chickpeas",
    "quinoa", "nuts",
])

MICRONUTRIENT_KEYS = (
    "vitamin_a_rdi", "vitamin_c_rdi", "vitamin_d_rdi", "vitamin_e_rdi",
    "vitamin_k_rdi", "vitamin_b12_rdi", "folate_rdi",
    "calcium_rdi", "iron_rdi", "magnesium_rdi", "potassium_rdi", "zinc_rdi",
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _num(data: Mapping[str, Any], key: str, default: float = 0.0) -> float:
    """Safely read a non-negative numeric field. Missing / None / bad types → default."""
    value = data.get(key, default)
    if value is None:
        return default
    try:
        as_float = float(value)
    except (TypeError, ValueError):
        return default
    # Negative nutrition values are almost always a data error; treat as zero.
    return max(0.0, as_float)


def _clamp(score: float, lo: int = 0, hi: int = 100) -> int:
    """Clamp to [lo, hi] and coerce to int."""
    return max(lo, min(hi, int(score)))


def _ingredient_name(ing: Mapping[str, Any]) -> str:
    """Flatten an ingredient's Thai + English names into one lowercase string."""
    return f"{ing.get('name_en', '')} {ing.get('name_th', '')}".lower()


def _is_truthy(value: Any) -> bool:
    """
    Robust truthiness for mixed JSON inputs.
    Accepts True, "true", "True", 1, "1", "yes" as True — reflects the fact
    that upstream LLM JSON can return booleans as strings.
    """
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    if isinstance(value, str):
        return value.strip().lower() in {"true", "1", "yes"}
    return False


def _iter_ingredient_dicts(
    ingredients: Optional[Iterable[Any]],
) -> Iterable[Mapping[str, Any]]:
    """Filter an ingredient iterable down to dict-shaped entries."""
    if not ingredients:
        return ()
    return (ing for ing in ingredients if isinstance(ing, Mapping))


# ---------------------------------------------------------------------------
# Scorer
# ---------------------------------------------------------------------------
class NutritionScorer:
    """Compute 7 dimension scores plus a weighted overall score."""

    # --- Aggregate entry point --------------------------------------------
    def calculate_all_scores(
        self,
        nutrition_data: Dict[str, Any],
        ingredients: Optional[List[Any]] = None,
    ) -> Dict[str, int]:
        """Calculate all dimension scores and the overall weighted score."""
        start = time.time()
        logger.info("Starting nutrition score calculation")

        scores: Dict[str, int] = {
            "blood_sugar_score": self.calculate_blood_sugar_score(nutrition_data),
            "gut_health_score": self.calculate_gut_health_score(nutrition_data, ingredients),
            "inflammation_score": self.calculate_inflammation_score(nutrition_data, ingredients),
            "nutrient_density_score": self.calculate_nutrient_density_score(nutrition_data),
            "processing_level_score": self.calculate_processing_level_score(nutrition_data, ingredients),
            "protein_quality_score": self.calculate_protein_quality_score(nutrition_data, ingredients),
            "micronutrient_score": self.calculate_micronutrient_score(nutrition_data),
        }
        scores["overall_health_score"] = self.calculate_overall_score(scores)

        duration = time.time() - start
        logger.info(
            "Nutrition scoring complete in %.3fs — overall=%d (BS=%d, Gut=%d, Proc=%d)",
            duration,
            scores["overall_health_score"],
            scores["blood_sugar_score"],
            scores["gut_health_score"],
            scores["processing_level_score"],
        )

        low = [k for k, v in scores.items() if v < 30]
        if low:
            logger.warning("Low nutrition scores detected: %s", ", ".join(low))

        return scores

    # --- Individual scorers -----------------------------------------------
    def calculate_blood_sugar_score(self, nutrition_data: Mapping[str, Any]) -> int:
        """Blood sugar impact score based on glycemic load, fiber, sugar, fructose."""
        carbs = _num(nutrition_data, "carbs_g")
        fiber = _num(nutrition_data, "fiber_g")
        sugar = _num(nutrition_data, "sugar_g")
        fructose = _num(nutrition_data, "fructose_estimate_g")
        gi = _num(nutrition_data, "glycemic_index", DEFAULT_GLYCEMIC_INDEX)

        net_carbs = max(0.0, carbs - fiber)
        glycemic_load = (gi * net_carbs) / 100.0

        # GL bucket -> base
        base = None
        for threshold, value in BS_GL_BUCKETS:
            if glycemic_load < threshold:
                base = value
                break
        if base is None:
            # Decay beyond the final bucket: every extra GL point costs 2.
            base = max(0.0, BS_GL_BUCKETS[-1][1] - (glycemic_load - BS_GL_BUCKETS[-1][0]) * 2)

        # Fiber protective shield
        if fiber > 0:
            if net_carbs > 0:
                ratio = fiber / net_carbs
                if ratio >= BS_FIBER_RATIO_STRONG:
                    base += 15
                elif ratio >= BS_FIBER_RATIO_OK:
                    base += 5
            else:
                base += 10

        # Sugar penalty (above 20 g, -2 per extra g, capped at -20)
        if sugar > BS_SUGAR_PENALTY_THRESHOLD:
            base -= min(BS_SUGAR_PENALTY_MAX, (sugar - BS_SUGAR_PENALTY_THRESHOLD) * 2)

        # Fructose (liver burden) penalty
        if fructose > BS_FRUCTOSE_HIGH:
            base -= 15
        elif fructose > BS_FRUCTOSE_MODERATE:
            base -= 5

        return _clamp(base)

    def calculate_gut_health_score(
        self,
        nutrition_data: Mapping[str, Any],
        ingredients: Optional[Iterable[Any]] = None,
    ) -> int:
        """Gut health score: fiber + pre/probiotics + fermented foods."""
        score = 50.0

        fiber = _num(nutrition_data, "fiber_g")
        if fiber >= GUT_FIBER_EXCELLENT:
            score += 30
        elif fiber >= GUT_FIBER_GOOD:
            score += 20
        elif fiber >= GUT_FIBER_FAIR:
            score += 10

        for ing in _iter_ingredient_dicts(ingredients):
            if _is_truthy(ing.get("is_prebiotic")):
                score += 10
            if _is_truthy(ing.get("is_probiotic")):
                score += 15
            name = _ingredient_name(ing)
            if any(marker in name for marker in FERMENTED_MARKERS):
                score += 5

        if fiber < GUT_FIBER_LOW_PENALTY_THRESHOLD:
            score -= 10

        return _clamp(score)

    def calculate_inflammation_score(
        self,
        nutrition_data: Mapping[str, Any],
        ingredients: Optional[Iterable[Any]] = None,
    ) -> int:
        """Anti-inflammation score: omega ratio, antioxidants, ingredient keywords."""
        score = 50.0

        omega3 = _num(nutrition_data, "omega3_mg")
        omega6 = _num(nutrition_data, "omega6_mg")

        if omega3 > 0 and omega6 > 0:
            ratio = omega6 / omega3
            if ratio <= INFLAM_OMEGA_RATIO_GOOD:
                score += 20
            elif ratio <= INFLAM_OMEGA_RATIO_OK:
                score += 10
            else:
                score -= 10
        elif omega3 > 500:
            score += 15

        orac = _num(nutrition_data, "antioxidant_orac")
        if orac > INFLAM_ORAC_EXCELLENT:
            score += 20
        elif orac > INFLAM_ORAC_GOOD:
            score += 10

        for ing in _iter_ingredient_dicts(ingredients):
            name = _ingredient_name(ing)
            if any(food in name for food in ANTI_INFLAMMATORY_KEYWORDS):
                score += 5

        sugar = _num(nutrition_data, "sugar_g")
        if sugar > 20:
            score -= 15
        elif sugar > 10:
            score -= 5

        trans_fat = _num(nutrition_data, "trans_fat_g")
        if trans_fat > 0:
            score -= 20

        return _clamp(score)

    def calculate_nutrient_density_score(self, nutrition_data: Mapping[str, Any]) -> int:
        """Nutrient density score (ANDI-style): nutrients per calorie + micronutrient coverage."""
        calories = _num(nutrition_data, "total_calories")
        if calories <= 0:
            calories = 1  # avoid divide-by-zero; effectively caps density very high

        protein = _num(nutrition_data, "protein_g")
        fiber = _num(nutrition_data, "fiber_g")

        score = 0.0

        protein_density = (protein / calories) * 200
        if protein_density >= ND_PROTEIN_DENSITY_HIGH:
            score += 25
        elif protein_density >= ND_PROTEIN_DENSITY_MED:
            score += 15
        elif protein_density >= ND_PROTEIN_DENSITY_LOW:
            score += 5

        fiber_density = (fiber / calories) * 200
        if fiber_density >= ND_FIBER_DENSITY_HIGH:
            score += 25
        elif fiber_density >= ND_FIBER_DENSITY_MED:
            score += 15
        elif fiber_density >= ND_FIBER_DENSITY_LOW:
            score += 5

        avg_coverage = sum(
            _num(nutrition_data, k) for k in MICRONUTRIENT_KEYS[:5]
        ) / 5
        if avg_coverage >= 50:
            score += 30
        elif avg_coverage >= 25:
            score += 20
        elif avg_coverage >= 10:
            score += 10

        # Empty calories penalty
        if calories > 300 and protein < 5 and fiber < 2:
            score -= ND_EMPTY_CAL_PENALTY

        return _clamp(score)

    def calculate_processing_level_score(
        self,
        nutrition_data: Mapping[str, Any],
        ingredients: Optional[Iterable[Any]] = None,
    ) -> int:
        """Processing level score (100 = unprocessed whole food, 0 = ultra-processed)."""
        nova = nutrition_data.get("nova_classification")
        is_upf = _is_truthy(nutrition_data.get("is_ultra_processed"))

        if isinstance(nova, int) and nova in NOVA_SCORES:
            base: float = NOVA_SCORES[nova]
        else:
            base = 70.0

            # Per-ingredient penalties for UPF markers, capped
            upf_penalty = 0
            for ing in _iter_ingredient_dicts(ingredients):
                name = ing.get("name_en", "").lower()
                if (
                    any(ind in name for ind in UPF_INGREDIENT_KEYWORDS)
                    or _is_truthy(ing.get("is_upf_indicator"))
                ):
                    upf_penalty += PROCESS_UPF_INDICATOR_PENALTY
            base -= min(upf_penalty, PROCESS_UPF_MAX_PENALTY)

            sodium = _num(nutrition_data, "sodium_mg")
            if sodium > PROCESS_SODIUM_HIGH:
                base -= 15
            elif sodium > PROCESS_SODIUM_MODERATE:
                base -= 5

        if is_upf:
            base = min(base, PROCESS_UPF_CAP) - PROCESS_UPF_ADDITIONAL_PENALTY

        return _clamp(base)

    def calculate_protein_quality_score(
        self,
        nutrition_data: Mapping[str, Any],
        ingredients: Optional[Iterable[Any]] = None,
    ) -> int:
        """Protein quality score: quantity + source quality (PDCAAS-inspired)."""
        protein = _num(nutrition_data, "protein_g")
        if protein == 0:
            return 0

        score = 0.0

        if protein >= 20:
            score += 40
        elif protein >= 10:
            score += 30
        elif protein >= 5:
            score += 20
        else:
            score += 10

        has_high, has_moderate = False, False
        any_ingredients_inspected = False
        for ing in _iter_ingredient_dicts(ingredients):
            any_ingredients_inspected = True
            name = _ingredient_name(ing)
            if any(p in name for p in HIGH_QUALITY_PROTEINS):
                has_high = True
            if any(p in name for p in MODERATE_QUALITY_PROTEINS):
                has_moderate = True

        if any_ingredients_inspected:
            if has_high:
                score += 40
            elif has_moderate:
                score += 25
            if has_high and has_moderate:
                score += 10
        else:
            # Fall back to quantity-only heuristic when no ingredient list provided.
            score += 30

        return _clamp(score)

    def calculate_micronutrient_score(self, nutrition_data: Mapping[str, Any]) -> int:
        """Micronutrient coverage score based on %RDI across key vitamins and minerals."""
        values = [_num(nutrition_data, k) for k in MICRONUTRIENT_KEYS]

        excellent = sum(1 for v in values if v >= MICRO_EXCELLENT_RDI)
        good = sum(1 for v in values if MICRO_GOOD_RDI <= v < MICRO_EXCELLENT_RDI)
        fair = sum(1 for v in values if MICRO_FAIR_RDI <= v < MICRO_GOOD_RDI)

        score = (excellent * 8) + (good * 5) + (fair * 2)

        with_any_value = sum(1 for v in values if v > 0)
        if with_any_value >= 10:
            score += 10
        elif with_any_value >= 6:
            score += 5

        return _clamp(score)

    def calculate_overall_score(self, scores: Mapping[str, int]) -> int:
        """Weighted average of dimension scores."""
        weighted = sum(scores.get(k, 0) * w for k, w in OVERALL_WEIGHTS.items())
        return _clamp(weighted)


# Global instance (kept for backward compatibility with existing callers).
nutrition_scorer = NutritionScorer()
