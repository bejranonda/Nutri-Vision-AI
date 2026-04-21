"""
Unit tests for app.services.nutrition_scorer.

Covers:
- Each dimension scorer: standard case, edge cases (zero, missing data,
  negative inputs), extreme cases (clamping)
- Overall weighted-score sums correctly
- `_is_truthy` handles mixed JSON types (previously a bug in processing score)
- Ingredient helpers (dict-only filter)
"""
import pytest

from app.services import nutrition_scorer as ns
from app.services.nutrition_scorer import NutritionScorer, _clamp, _is_truthy, _num


scorer = NutritionScorer()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
class TestHelpers:
    @pytest.mark.parametrize("value,expected", [
        (True, True), (False, False),
        ("true", True), ("TRUE", True), ("True  ", True),
        ("false", False), ("", False),
        (1, True), (0, False),
        ("1", True), ("0", False),
        ("yes", True), ("no", False),
        (None, False), ({}, False), ([], False),
    ])
    def test_is_truthy(self, value, expected):
        assert _is_truthy(value) is expected

    def test_clamp(self):
        assert _clamp(150) == 100
        assert _clamp(-10) == 0
        assert _clamp(50.7) == 50

    def test_num_handles_missing_none_and_bad_types(self):
        data = {"a": 5, "b": None, "c": "bad", "d": "3.5", "e": -2}
        assert _num(data, "a") == 5
        assert _num(data, "b") == 0
        assert _num(data, "c") == 0
        assert _num(data, "d") == 3.5
        # Negative values clamped to zero — a defensive choice.
        assert _num(data, "e") == 0
        assert _num(data, "missing", default=7) == 7


# ---------------------------------------------------------------------------
# Blood sugar score
# ---------------------------------------------------------------------------
class TestBloodSugarScore:
    def test_low_gl_high_fiber(self):
        """Whole-food salad: high fiber, low carbs → near-max score."""
        score = scorer.calculate_blood_sugar_score({
            "carbs_g": 10, "fiber_g": 5, "sugar_g": 2,
            "fructose_estimate_g": 0, "glycemic_index": 40,
        })
        assert score >= 90

    def test_high_gl_sugary(self):
        """Soda / candy: high sugar, high fructose → very low score."""
        score = scorer.calculate_blood_sugar_score({
            "carbs_g": 80, "fiber_g": 0, "sugar_g": 60,
            "fructose_estimate_g": 30, "glycemic_index": 95,
        })
        assert score <= 20

    def test_missing_data_uses_defaults(self):
        score = scorer.calculate_blood_sugar_score({})
        assert 0 <= score <= 100

    def test_score_is_clamped(self):
        # Extremely pathological input should still be within [0, 100]
        score = scorer.calculate_blood_sugar_score({
            "carbs_g": 1000, "sugar_g": 500, "fructose_estimate_g": 200,
        })
        assert 0 <= score <= 100

    def test_fiber_no_net_carbs_grants_bonus(self):
        """Pure fiber (no digestible carbs) → base score + 10 bonus."""
        score = scorer.calculate_blood_sugar_score({
            "carbs_g": 5, "fiber_g": 5, "glycemic_index": 50,
        })
        assert score >= 95


# ---------------------------------------------------------------------------
# Gut health
# ---------------------------------------------------------------------------
class TestGutHealthScore:
    def test_high_fiber_with_probiotics(self):
        ingredients = [{"is_probiotic": True, "name_en": "yogurt", "name_th": ""}]
        score = scorer.calculate_gut_health_score(
            {"fiber_g": 12}, ingredients
        )
        assert score >= 90

    def test_low_fiber_penalty(self):
        score = scorer.calculate_gut_health_score({"fiber_g": 1})
        # Base 50 minus 10 low-fiber penalty
        assert score == 40

    def test_fermented_marker_detected(self):
        ingredients = [{"name_en": "fermented tofu", "name_th": ""}]
        with_ferment = scorer.calculate_gut_health_score({"fiber_g": 5}, ingredients)
        without = scorer.calculate_gut_health_score({"fiber_g": 5}, [])
        assert with_ferment > without

    def test_non_dict_ingredient_ignored(self):
        # Previously a risk if ingredient list contained strings
        score = scorer.calculate_gut_health_score({"fiber_g": 5}, ["not-a-dict"])
        assert 0 <= score <= 100


# ---------------------------------------------------------------------------
# Inflammation
# ---------------------------------------------------------------------------
class TestInflammationScore:
    def test_good_omega_ratio(self):
        score = scorer.calculate_inflammation_score({
            "omega3_mg": 1000, "omega6_mg": 3000,  # ratio 3
        })
        assert score > 60

    def test_bad_omega_ratio_penalized(self):
        good = scorer.calculate_inflammation_score({"omega3_mg": 100, "omega6_mg": 200})
        bad = scorer.calculate_inflammation_score({"omega3_mg": 100, "omega6_mg": 2000})
        assert bad < good

    def test_trans_fat_severe_penalty(self):
        without = scorer.calculate_inflammation_score({})
        with_trans = scorer.calculate_inflammation_score({"trans_fat_g": 1})
        assert with_trans == without - 20

    def test_anti_inflammatory_keywords(self):
        score = scorer.calculate_inflammation_score(
            {},
            [{"name_en": "turmeric paste", "name_th": "ขมิ้น"}],
        )
        # +5 for turmeric keyword
        assert score >= 55


# ---------------------------------------------------------------------------
# Nutrient density
# ---------------------------------------------------------------------------
class TestNutrientDensityScore:
    def test_dense_meal(self):
        score = scorer.calculate_nutrient_density_score({
            "total_calories": 300, "protein_g": 30, "fiber_g": 10,
            "vitamin_a_rdi": 60, "vitamin_c_rdi": 80, "iron_rdi": 50,
            "calcium_rdi": 40, "vitamin_d_rdi": 30,
        })
        assert score >= 70

    def test_empty_calories_penalty(self):
        """High-cal, low-nutrient food gets the -20 penalty."""
        score = scorer.calculate_nutrient_density_score({
            "total_calories": 500, "protein_g": 1, "fiber_g": 1,
        })
        assert score <= 10  # penalty + no density bonuses

    def test_zero_calories_does_not_crash(self):
        assert scorer.calculate_nutrient_density_score({"total_calories": 0}) >= 0

    def test_missing_calories_treated_as_one(self):
        assert scorer.calculate_nutrient_density_score({}) >= 0


# ---------------------------------------------------------------------------
# Processing level
# ---------------------------------------------------------------------------
class TestProcessingLevelScore:
    def test_nova_1_unprocessed(self):
        assert scorer.calculate_processing_level_score({"nova_classification": 1}) == 100

    def test_nova_4_ultra_processed(self):
        # NOVA 4 = base 25; is_upf flag not set → returns 25
        assert scorer.calculate_processing_level_score({"nova_classification": 4}) == 25

    def test_upf_flag_caps_and_penalizes(self):
        """is_ultra_processed should cap to 30 then subtract 10 more."""
        score = scorer.calculate_processing_level_score({
            "nova_classification": 1,  # base 100
            "is_ultra_processed": True,
        })
        assert score == 20  # min(100, 30) - 10

    def test_string_boolean_ultra_processed(self):
        """Regression: string 'true' should be handled by _is_truthy."""
        numeric = scorer.calculate_processing_level_score({
            "nova_classification": 1, "is_ultra_processed": True,
        })
        stringy = scorer.calculate_processing_level_score({
            "nova_classification": 1, "is_ultra_processed": "true",
        })
        assert numeric == stringy == 20

    def test_upf_indicator_ingredients_penalized(self):
        ingredients = [
            {"name_en": "maltodextrin", "is_upf_indicator": True},
            {"name_en": "artificial flavor"},
        ]
        clean = scorer.calculate_processing_level_score({})
        dirty = scorer.calculate_processing_level_score({}, ingredients)
        assert dirty < clean

    def test_high_sodium_penalty(self):
        low = scorer.calculate_processing_level_score({"sodium_mg": 100})
        high = scorer.calculate_processing_level_score({"sodium_mg": 1000})
        assert high < low


# ---------------------------------------------------------------------------
# Protein quality
# ---------------------------------------------------------------------------
class TestProteinQualityScore:
    def test_zero_protein_zero_score(self):
        assert scorer.calculate_protein_quality_score({"protein_g": 0}) == 0

    def test_high_quality_sources_score_high(self):
        ingredients = [{"name_en": "grilled chicken", "name_th": "ไก่ย่าง"}]
        score = scorer.calculate_protein_quality_score(
            {"protein_g": 25}, ingredients
        )
        assert score >= 80

    def test_combined_protein_sources_bonus(self):
        ingredients = [
            {"name_en": "chicken", "name_th": ""},
            {"name_en": "beans", "name_th": ""},
        ]
        score = scorer.calculate_protein_quality_score(
            {"protein_g": 20}, ingredients
        )
        # 40 (quantity ≥20g) + 40 (high-quality) + 10 (combo bonus) = 90
        assert score == 90

    def test_no_ingredients_provided_uses_default_bonus(self):
        score = scorer.calculate_protein_quality_score({"protein_g": 25})
        # 40 (quantity) + 30 (default) = 70
        assert score == 70


# ---------------------------------------------------------------------------
# Micronutrient
# ---------------------------------------------------------------------------
class TestMicronutrientScore:
    def test_zero_when_empty(self):
        # No nutrients present → score 0 (with_any_value == 0 so no breadth bonus)
        assert scorer.calculate_micronutrient_score({}) == 0

    def test_comprehensive_coverage_scores_high(self):
        data = {k: 60 for k in ns.MICRONUTRIENT_KEYS}  # all excellent
        score = scorer.calculate_micronutrient_score(data)
        # 12 excellent × 8 = 96 + 10 breadth bonus → clamped to 100
        assert score == 100

    def test_score_clamped_to_100(self):
        data = {k: 100 for k in ns.MICRONUTRIENT_KEYS}
        assert scorer.calculate_micronutrient_score(data) <= 100


# ---------------------------------------------------------------------------
# Overall score
# ---------------------------------------------------------------------------
class TestOverallScore:
    def test_weights_sum_to_one(self):
        assert abs(sum(ns.OVERALL_WEIGHTS.values()) - 1.0) < 1e-9

    def test_all_perfect_yields_100(self):
        scores = {k: 100 for k in ns.OVERALL_WEIGHTS}
        assert scorer.calculate_overall_score(scores) == 100

    def test_all_zero_yields_0(self):
        scores = {k: 0 for k in ns.OVERALL_WEIGHTS}
        assert scorer.calculate_overall_score(scores) == 0

    def test_aggregate_scoring_pipeline(self):
        result = scorer.calculate_all_scores({
            "total_calories": 400, "protein_g": 25, "carbs_g": 30,
            "fiber_g": 8, "sugar_g": 3, "nova_classification": 2,
        })
        expected_keys = set(ns.OVERALL_WEIGHTS.keys()) | {"overall_health_score"}
        assert set(result.keys()) == expected_keys
        for k, v in result.items():
            assert 0 <= v <= 100, f"{k}={v} out of range"
