"""
Nutrition scoring service.
Implements 8-dimension health scoring system based on modern nutrition science.
"""
import logging
from typing import Dict, Any, Optional
import math

logger = logging.getLogger(__name__)


class NutritionScorer:
    """
    Calculate comprehensive nutrition scores across 8 dimensions.
    Each score ranges from 0-100 (higher is better).
    """

    def calculate_all_scores(
        self,
        nutrition_data: Dict[str, Any],
        ingredients: Optional[list] = None
    ) -> Dict[str, int]:
        """
        Calculate all 8 nutrition scores.

        Args:
            nutrition_data: Dictionary with nutrition information
            ingredients: Optional list of ingredient details

        Returns:
            Dictionary with all 8 scores plus overall score
        """
        scores = {
            "blood_sugar_score": self.calculate_blood_sugar_score(nutrition_data),
            "gut_health_score": self.calculate_gut_health_score(nutrition_data, ingredients),
            "inflammation_score": self.calculate_inflammation_score(nutrition_data, ingredients),
            "nutrient_density_score": self.calculate_nutrient_density_score(nutrition_data),
            "processing_level_score": self.calculate_processing_level_score(nutrition_data, ingredients),
            "protein_quality_score": self.calculate_protein_quality_score(nutrition_data, ingredients),
            "micronutrient_score": self.calculate_micronutrient_score(nutrition_data),
            "overall_health_score": 0  # Will be calculated after others
        }

        # Calculate overall score as weighted average
        scores["overall_health_score"] = self.calculate_overall_score(scores)

        return scores

    def calculate_blood_sugar_score(self, nutrition_data: Dict[str, Any]) -> int:
        """
        Calculate blood sugar impact score (0-100).
        Based on glycemic load, fiber content, and carb quality.

        Score breakdown:
        - 90-100: Very low impact (GL < 10)
        - 70-89: Low impact (GL 10-19)
        - 50-69: Medium impact (GL 20-29)
        - 30-49: High impact (GL 30-39)
        - 0-29: Very high impact (GL > 40)
        """
        try:
            carbs = nutrition_data.get("carbs_g", 0)
            fiber = nutrition_data.get("fiber_g", 0)
            sugar = nutrition_data.get("sugar_g", 0)
            glycemic_index = nutrition_data.get("glycemic_index", 70)  # Default medium GI

            # Calculate glycemic load: (GI × carbs) / 100
            net_carbs = max(0, carbs - fiber)
            glycemic_load = (glycemic_index * net_carbs) / 100

            # Base score from GL
            if glycemic_load < 10:
                base_score = 95
            elif glycemic_load < 20:
                base_score = 80
            elif glycemic_load < 30:
                base_score = 60
            elif glycemic_load < 40:
                base_score = 40
            else:
                base_score = max(0, 40 - (glycemic_load - 40) * 2)

            # Bonus for high fiber
            if fiber > 0:
                fiber_bonus = min(15, fiber * 2)
                base_score += fiber_bonus

            # Penalty for high sugar
            if sugar > 20:
                sugar_penalty = min(20, (sugar - 20) * 2)
                base_score -= sugar_penalty

            return max(0, min(100, int(base_score)))

        except Exception as e:
            logger.error(f"Error calculating blood sugar score: {e}")
            return 50  # Default middle score

    def calculate_gut_health_score(
        self,
        nutrition_data: Dict[str, Any],
        ingredients: Optional[list] = None
    ) -> int:
        """
        Calculate gut health score (0-100).
        Based on fiber, prebiotics, probiotics, and fermented foods.
        """
        try:
            score = 50  # Base score

            # Fiber content (major factor)
            fiber = nutrition_data.get("fiber_g", 0)
            if fiber >= 10:
                score += 30
            elif fiber >= 5:
                score += 20
            elif fiber >= 3:
                score += 10

            # Check for prebiotics and probiotics in ingredients
            if ingredients:
                for ingredient in ingredients:
                    if isinstance(ingredient, dict):
                        # Prebiotic foods (onions, garlic, asparagus, etc.)
                        if ingredient.get("is_prebiotic"):
                            score += 10

                        # Probiotic foods (yogurt, kimchi, fermented foods)
                        if ingredient.get("is_probiotic"):
                            score += 15

                        # Fermented Thai foods bonus
                        name = ingredient.get("name_en", "").lower()
                        if any(x in name for x in ["fermented", "pickled", "น้ำปลา", "ปลาร้า"]):
                            score += 5

            # Penalty for low fiber
            if fiber < 2:
                score -= 10

            return max(0, min(100, int(score)))

        except Exception as e:
            logger.error(f"Error calculating gut health score: {e}")
            return 50

    def calculate_inflammation_score(
        self,
        nutrition_data: Dict[str, Any],
        ingredients: Optional[list] = None
    ) -> int:
        """
        Calculate inflammation score (0-100).
        Higher score = anti-inflammatory.
        Based on omega-3:omega-6 ratio and antioxidants.
        """
        try:
            score = 50  # Base score

            # Omega-3 to Omega-6 ratio (ideal is 1:1 to 1:4)
            omega3 = nutrition_data.get("omega3_mg", 0)
            omega6 = nutrition_data.get("omega6_mg", 0)

            if omega3 > 0 and omega6 > 0:
                ratio = omega6 / omega3
                if ratio <= 4:  # Good ratio
                    score += 20
                elif ratio <= 10:  # Acceptable
                    score += 10
                else:  # High omega-6
                    score -= 10
            elif omega3 > 500:  # High omega-3 even without omega-6 data
                score += 15

            # Antioxidant content (ORAC score)
            orac = nutrition_data.get("antioxidant_orac", 0)
            if orac > 5000:
                score += 20
            elif orac > 2000:
                score += 10

            # Check for anti-inflammatory ingredients
            if ingredients:
                anti_inflammatory_foods = [
                    "turmeric", "ขมิ้น", "ginger", "ขิง",
                    "garlic", "กระเทียม", "green tea", "ชาเขียว",
                    "berries", "tomato", "olive oil"
                ]

                for ingredient in ingredients:
                    if isinstance(ingredient, dict):
                        name = (ingredient.get("name_en", "") + " " +
                               ingredient.get("name_th", "")).lower()

                        if any(food in name for food in anti_inflammatory_foods):
                            score += 5

            # Penalty for high sugar (pro-inflammatory)
            sugar = nutrition_data.get("sugar_g", 0)
            if sugar > 20:
                score -= 15
            elif sugar > 10:
                score -= 5

            # Penalty for trans fats
            trans_fat = nutrition_data.get("trans_fat_g", 0)
            if trans_fat > 0:
                score -= 20

            return max(0, min(100, int(score)))

        except Exception as e:
            logger.error(f"Error calculating inflammation score: {e}")
            return 50

    def calculate_nutrient_density_score(self, nutrition_data: Dict[str, Any]) -> int:
        """
        Calculate nutrient density score (0-100).
        Based on ANDI (Aggregate Nutrient Density Index) concept.
        Nutrients per calorie ratio.
        """
        try:
            calories = nutrition_data.get("total_calories", 1)  # Avoid division by zero
            if calories == 0:
                calories = 1

            score = 0

            # Macronutrients value
            protein = nutrition_data.get("protein_g", 0)
            fiber = nutrition_data.get("fiber_g", 0)

            # Protein density (ideal: >15g per 200 cal)
            protein_density = (protein / calories) * 200
            if protein_density >= 15:
                score += 25
            elif protein_density >= 10:
                score += 15
            elif protein_density >= 5:
                score += 5

            # Fiber density (ideal: >5g per 200 cal)
            fiber_density = (fiber / calories) * 200
            if fiber_density >= 5:
                score += 25
            elif fiber_density >= 3:
                score += 15
            elif fiber_density >= 1:
                score += 5

            # Micronutrient richness (simplified)
            vitamins = {
                "vitamin_a": nutrition_data.get("vitamin_a_rdi", 0),
                "vitamin_c": nutrition_data.get("vitamin_c_rdi", 0),
                "vitamin_d": nutrition_data.get("vitamin_d_rdi", 0),
                "iron": nutrition_data.get("iron_rdi", 0),
                "calcium": nutrition_data.get("calcium_rdi", 0),
            }

            # Average micronutrient coverage
            avg_coverage = sum(vitamins.values()) / len(vitamins) if vitamins else 0

            if avg_coverage >= 50:
                score += 30
            elif avg_coverage >= 25:
                score += 20
            elif avg_coverage >= 10:
                score += 10

            # Penalty for empty calories (high calorie, low nutrient)
            if calories > 300 and protein < 5 and fiber < 2:
                score -= 20

            return max(0, min(100, int(score)))

        except Exception as e:
            logger.error(f"Error calculating nutrient density score: {e}")
            return 50

    def calculate_processing_level_score(
        self,
        nutrition_data: Dict[str, Any],
        ingredients: Optional[list] = None
    ) -> int:
        """
        Calculate processing level score (0-100).
        Based on NOVA classification.
        NOVA 1 (unprocessed) = 100
        NOVA 2 (processed culinary ingredients) = 75
        NOVA 3 (processed foods) = 50
        NOVA 4 (ultra-processed) = 25
        """
        try:
            # Get NOVA classification if available
            nova = nutrition_data.get("nova_classification", None)

            if nova:
                nova_scores = {1: 100, 2: 75, 3: 50, 4: 25}
                base_score = nova_scores.get(nova, 50)
            else:
                # Estimate from ingredients and nutrition
                base_score = 70  # Assume moderately processed

                # Indicators of ultra-processing
                if ingredients:
                    processed_indicators = [
                        "artificial", "preservative", "flavoring",
                        "coloring", "emulsifier", "sweetener"
                    ]

                    for ingredient in ingredients:
                        if isinstance(ingredient, dict):
                            name = ingredient.get("name_en", "").lower()
                            if any(ind in name for ind in processed_indicators):
                                base_score -= 10

                # High sodium often indicates processing
                sodium = nutrition_data.get("sodium_mg", 0)
                if sodium > 800:
                    base_score -= 15
                elif sodium > 400:
                    base_score -= 5

                # High sugar in non-fruit items
                sugar = nutrition_data.get("sugar_g", 0)
                if sugar > 15 and not nutrition_data.get("is_fruit", False):
                    base_score -= 10

            return max(0, min(100, int(base_score)))

        except Exception as e:
            logger.error(f"Error calculating processing score: {e}")
            return 50

    def calculate_protein_quality_score(
        self,
        nutrition_data: Dict[str, Any],
        ingredients: Optional[list] = None
    ) -> int:
        """
        Calculate protein quality score (0-100).
        Based on PDCAAS (Protein Digestibility Corrected Amino Acid Score).
        """
        try:
            protein = nutrition_data.get("protein_g", 0)

            if protein == 0:
                return 0

            score = 0

            # Protein quantity score
            if protein >= 20:
                score += 40
            elif protein >= 10:
                score += 30
            elif protein >= 5:
                score += 20
            else:
                score += 10

            # Protein quality based on source
            if ingredients:
                high_quality_proteins = [
                    "chicken", "ไก่", "fish", "ปลา", "egg", "ไข่",
                    "beef", "เนื้อ", "pork", "หมู", "shrimp", "กุ้ง",
                    "tofu", "เต้าหู้", "tempeh"
                ]

                moderate_quality_proteins = [
                    "beans", "ถั่ว", "lentils", "chickpeas",
                    "quinoa", "nuts", "ถั่ว"
                ]

                has_high_quality = False
                has_moderate_quality = False

                for ingredient in ingredients:
                    if isinstance(ingredient, dict):
                        name = (ingredient.get("name_en", "") + " " +
                               ingredient.get("name_th", "")).lower()

                        if any(p in name for p in high_quality_proteins):
                            has_high_quality = True
                        if any(p in name for p in moderate_quality_proteins):
                            has_moderate_quality = True

                if has_high_quality:
                    score += 40
                elif has_moderate_quality:
                    score += 25

                # Bonus for complete amino acid profile (multiple protein sources)
                if has_high_quality and has_moderate_quality:
                    score += 10

            else:
                # Default assumption based on protein amount
                score += 30

            return max(0, min(100, int(score)))

        except Exception as e:
            logger.error(f"Error calculating protein quality score: {e}")
            return 50

    def calculate_micronutrient_score(self, nutrition_data: Dict[str, Any]) -> int:
        """
        Calculate micronutrient coverage score (0-100).
        Based on % RDI coverage across key vitamins and minerals.
        """
        try:
            # Key micronutrients to check
            micronutrients = {
                "vitamin_a_rdi": nutrition_data.get("vitamin_a_rdi", 0),
                "vitamin_c_rdi": nutrition_data.get("vitamin_c_rdi", 0),
                "vitamin_d_rdi": nutrition_data.get("vitamin_d_rdi", 0),
                "vitamin_e_rdi": nutrition_data.get("vitamin_e_rdi", 0),
                "vitamin_k_rdi": nutrition_data.get("vitamin_k_rdi", 0),
                "vitamin_b12_rdi": nutrition_data.get("vitamin_b12_rdi", 0),
                "folate_rdi": nutrition_data.get("folate_rdi", 0),
                "calcium_rdi": nutrition_data.get("calcium_rdi", 0),
                "iron_rdi": nutrition_data.get("iron_rdi", 0),
                "magnesium_rdi": nutrition_data.get("magnesium_rdi", 0),
                "potassium_rdi": nutrition_data.get("potassium_rdi", 0),
                "zinc_rdi": nutrition_data.get("zinc_rdi", 0),
            }

            # Count nutrients meeting thresholds
            excellent_count = sum(1 for v in micronutrients.values() if v >= 50)
            good_count = sum(1 for v in micronutrients.values() if 20 <= v < 50)
            fair_count = sum(1 for v in micronutrients.values() if 10 <= v < 20)

            # Calculate score
            score = (excellent_count * 8) + (good_count * 5) + (fair_count * 2)

            # Bonus for breadth of coverage
            nutrients_with_some_value = sum(1 for v in micronutrients.values() if v > 0)
            if nutrients_with_some_value >= 10:
                score += 10
            elif nutrients_with_some_value >= 6:
                score += 5

            return max(0, min(100, int(score)))

        except Exception as e:
            logger.error(f"Error calculating micronutrient score: {e}")
            return 50

    def calculate_overall_score(self, scores: Dict[str, int]) -> int:
        """
        Calculate overall health score as weighted average.

        Weights:
        - Blood sugar: 20% (critical for Thai population)
        - Gut health: 15%
        - Inflammation: 15%
        - Nutrient density: 15%
        - Processing: 15%
        - Protein quality: 10%
        - Micronutrients: 10%
        """
        try:
            weights = {
                "blood_sugar_score": 0.20,
                "gut_health_score": 0.15,
                "inflammation_score": 0.15,
                "nutrient_density_score": 0.15,
                "processing_level_score": 0.15,
                "protein_quality_score": 0.10,
                "micronutrient_score": 0.10,
            }

            weighted_sum = sum(
                scores.get(key, 0) * weight
                for key, weight in weights.items()
            )

            return max(0, min(100, int(weighted_sum)))

        except Exception as e:
            logger.error(f"Error calculating overall score: {e}")
            return 50


# Global instance
nutrition_scorer = NutritionScorer()
