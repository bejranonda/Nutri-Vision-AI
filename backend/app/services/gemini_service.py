"""
Google Gemini AI service for image recognition and chat.

Handles ingredient detection, nutritional analysis, and conversational AI.
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
import time
from typing import Any, Dict, List, Mapping, Optional

import google.generativeai as genai
from PIL import Image

from app.core.config import settings

logger = logging.getLogger(__name__)

# Regex that extracts JSON from an LLM response. Matches ```json fenced blocks,
# ``` fenced blocks, or the first {...} / [...] in the response. Using regex
# (instead of naive split) means a missing closing fence or repeated fences
# don't raise IndexError.
_FENCED_JSON_RE = re.compile(r"```(?:json)?\s*(.*?)```", re.DOTALL | re.IGNORECASE)
_BARE_JSON_RE = re.compile(r"(\{.*\}|\[.*\])", re.DOTALL)


class GeminiService:
    """Service for interacting with Google Gemini AI."""

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize the Gemini client.

        Args:
            api_key: Optional override for the API key. Defaults to settings.
                     Constructor-level configuration (as opposed to import-time)
                     makes the module importable in tests without env vars.
        """
        self.api_key = api_key or settings.GEMINI_API_KEY
        genai.configure(api_key=self.api_key)

        self.model_name = settings.GEMINI_MODEL
        self.generation_config = {
            "temperature": settings.GEMINI_TEMPERATURE,
            "max_output_tokens": settings.GEMINI_MAX_TOKENS,
        }
        logger.info("Initialized GeminiService with model: %s", self.model_name)

    # ------------------------------------------------------------------
    # Food image analysis
    # ------------------------------------------------------------------
    async def analyze_food_image(
        self,
        image_path: str,
        language: str = "th",
    ) -> Dict[str, Any]:
        """
        Analyze a food image and extract nutritional information.

        Runs the blocking Gemini SDK call in a thread so it doesn't stall the
        event loop. The image file handle is released before the network call.
        """
        start = time.time()
        logger.info("Gemini analysis started for image=%s lang=%s", image_path, language)

        # Load image into memory and close the file handle.
        with Image.open(image_path) as img:
            img.load()
            img_size = img.size
            img_for_request = img.copy()

        logger.debug("Image loaded: %s (size=%s)", image_path, img_size)

        prompt = self._create_food_analysis_prompt(language)
        logger.debug("Prompt created (length=%d)", len(prompt))

        gen_start = time.time()
        response = await asyncio.to_thread(self._generate, [prompt, img_for_request])
        logger.info("Gemini generation complete in %.3fs", time.time() - gen_start)

        result = self._parse_json_response(response.text, fallback={
            "detected_items": [],
            "nutrition_summary": {},
            "ingredients": [],
            "health_insights": {},
            "thai_food_context": {},
        })

        logger.info(
            "Analyzed image=%s total=%.3fs items=%d",
            image_path,
            time.time() - start,
            len(result.get("detected_items", []) or []),
        )
        return result

    def _generate(self, parts: List[Any]):
        """Synchronous wrapper around Gemini content generation (for to_thread)."""
        model = genai.GenerativeModel(
            model_name=self.model_name,
            generation_config=self.generation_config,
        )
        return model.generate_content(parts)

    # ------------------------------------------------------------------
    # Chat
    # ------------------------------------------------------------------
    async def chat_nutrition_question(
        self,
        question: str,
        chat_history: Optional[List[Dict[str, str]]] = None,
        language: str = "th",
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Answer nutrition-related questions using Gemini AI."""
        system_prompt = self._create_chat_system_prompt(language, context)

        # Keep only the last 10 messages and skip malformed entries so a bad
        # row in history doesn't crash the endpoint.
        history_lines: List[str] = []
        for msg in (chat_history or [])[-10:]:
            if not isinstance(msg, Mapping):
                continue
            role = msg.get("role")
            content = msg.get("content")
            if role and content:
                history_lines.append(f"{role}: {content}")

        parts = [system_prompt]
        if history_lines:
            parts.append("Previous conversation:\n" + "\n".join(history_lines))
        parts.append(f"User: {question}\nAssistant:")
        full_prompt = "\n\n".join(parts)

        response = await asyncio.to_thread(self._generate, [full_prompt])

        logger.info("Answered nutrition question in %s", language)
        return {
            "answer": response.text,
            "model_used": self.model_name,
            "language": language,
            "has_context": context is not None,
        }

    # ------------------------------------------------------------------
    # Recipe suggestions
    # ------------------------------------------------------------------
    async def generate_recipe_suggestions(
        self,
        ingredients: List[str],
        dietary_restrictions: Optional[List[str]] = None,
        language: str = "th",
    ) -> Dict[str, Any]:
        """Generate recipe suggestions based on available ingredients."""
        prompt = self._create_recipe_suggestion_prompt(ingredients, dietary_restrictions, language)
        response = await asyncio.to_thread(self._generate, [prompt])
        result = self._parse_json_response(response.text, fallback={"recipes": []})
        logger.info("Generated recipe suggestions for %d ingredients", len(ingredients))
        return result

    # ------------------------------------------------------------------
    # Prompt builders
    # ------------------------------------------------------------------
    def _create_food_analysis_prompt(self, language: str) -> str:
        """Food-analysis prompt. Confidence is specified as 0–1 everywhere."""
        if language == "th":
            return """
วิเคราะห์ภาพนี้ตามขั้นตอนดังนี้:

ขั้นตอนที่ 1: ระบุว่าภาพนี้มีอาหารหรือไม่ ถ้าไม่ใช่อาหาร ให้ตั้ง isFood เป็น false
ขั้นตอนที่ 2: ระบุชื่ออาหาร/วัตถุดิบที่เห็นในภาพ (อาจเป็นผลไม้, ผัก, วัตถุดิบดิบ, อาหารปรุงแล้ว, ขนม, หรือเครื่องดื่ม)
ขั้นตอนที่ 3: วิเคราะห์คุณค่าทางโภชนาการ

สำคัญมาก:
- ระบุเฉพาะส่วนประกอบที่เห็นจริงในภาพเท่านั้น ห้ามเดาหรือสมมติส่วนประกอบที่ไม่ปรากฏ
- ถ้าเป็นผลไม้หรือผักดิบ ให้ระบุว่าเป็นผลไม้/ผัก ไม่ใช่อาหารปรุงแล้ว
- ระบุค่า confidence เป็นเลขทศนิยมระหว่าง 0.0 ถึง 1.0 (เช่น 0.95 = มั่นใจ 95%)

ตอบในรูปแบบ JSON เท่านั้น (ไม่ต้องมี markdown):

{
  "isFood": true,
  "foodName": "ชื่ออาหารหรือวัตถุดิบ",
  "foodCategory": "fruit/vegetable/prepared_dish/snack/beverage/dessert/other",
  "detected_items": [
    {
      "name_th": "ชื่ออาหารภาษาไทย",
      "name_en": "English name",
      "confidence": 0.95,
      "portion_size": "1 จาน (200g)",
      "is_thai_food": true
    }
  ],
  "nutrition_summary": {
    "total_calories": 450,
    "protein_g": 20,
    "carbs_g": 60,
    "fat_g": 15,
    "fiber_g": 8,
    "sugar_g": 5
  },
  "ingredients": [
    {
      "name_th": "ส่วนประกอบ",
      "name_en": "ingredient",
      "estimated_amount": "100g"
    }
  ],
  "health_insights": {
    "glycemic_load": 25,
    "is_high_fiber": true,
    "is_high_protein": false,
    "contains_vegetables": true,
    "processing_level": "minimally_processed",
    "is_ultra_processed": false,
    "satiety_index": "high/medium/low"
  },
  "thai_food_context": {
    "regional_origin": "ภาคกลาง/อีสาน/เหนือ/ใต้",
    "traditional_benefits": "ประโยชน์ตามความเชื่อไทย",
    "eating_recommendations": "ลำดับการกิน: ผัก -> โปรตีน -> คาร์โบไฮเดรต",
    "post_meal_advice": "เดินเล่น 10-15 นาทีเพื่อช่วยลดน้ำตาลพุ่ง"
  }
}

ถ้าเป็นอาหารไทย กรุณาระบุข้อมูลเฉพาะของอาหารไทย เช่น ส่วนประกอบตามสูตรไทย น้ำตาลในน้ำจิ้ม เป็นต้น
เน้นการวิเคราะห์ว่ามีส่วนประกอบของอาหารแปรรูปสูง (UPF) หรือไม่ และให้คำแนะนำตามหลัก "อร่อย ตาม ลำดับ"
"""
        return """
Analyze this image following these steps:

Step 1: Identify whether the image contains food. If not, set isFood to false.
Step 2: Identify the food/ingredient visible (could be raw fruit, vegetable, prepared dish, snack, beverage, or dessert).
Step 3: Provide nutritional analysis.

CRITICAL RULES:
- Only list ingredients that are ACTUALLY VISIBLE in the image. Do NOT hallucinate items.
- If the image shows raw fruit or vegetables, identify them as such, NOT as a prepared dish.
- Provide `confidence` as a decimal between 0.0 and 1.0 (e.g. 0.95 = 95% certain). If uncertain, use a low value.

Respond ONLY with valid JSON (no markdown):

{
  "isFood": true,
  "foodName": "Name of the dish or ingredient",
  "foodCategory": "fruit/vegetable/prepared_dish/snack/beverage/dessert/other",
  "detected_items": [
    {
      "name_th": "Thai name if applicable",
      "name_en": "English name",
      "confidence": 0.95,
      "portion_size": "1 plate (200g)",
      "is_thai_food": true
    }
  ],
  "nutrition_summary": {
    "total_calories": 450,
    "protein_g": 20,
    "carbs_g": 60,
    "fat_g": 15,
    "fiber_g": 8,
    "sugar_g": 5,
    "fructose_estimate_g": 2
  },
  "ingredients": [
    {
      "name_th": "Thai ingredient name",
      "name_en": "English ingredient name",
      "estimated_amount": "100g",
      "is_upf_indicator": false
    }
  ],
  "health_insights": {
    "glycemic_load": 25,
    "is_high_fiber": true,
    "is_high_protein": false,
    "contains_vegetables": true,
    "processing_level": "minimally_processed",
    "is_ultra_processed": false,
    "satiety_index": "high/medium/low"
  },
  "thai_food_context": {
    "regional_origin": "Central/Isan/Northern/Southern",
    "traditional_benefits": "Traditional Thai health benefits",
    "eating_recommendations": "Eat in order: Veggies -> Protein -> Carbs",
    "post_meal_advice": "Walk for 10-15 mins to flatten glucose spike"
  }
}

If this is Thai food, include specific Thai food context.
Identify Ultra-Processed Food (UPF) ingredients and provide recommendations based on "Delicious in Order" principles.
"""

    def _create_chat_system_prompt(
        self,
        language: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> str:
        """System prompt for chat based on language and context."""
        if language == "th":
            prompt = """
คุณคือ "ชินนี่" (Shinny) ผู้เชี่ยวชาญด้านโภชนาการและเจ้าของเพจ/ช่อง "อยู่เพื่อกินบำนาญ" (Live long to eat well)
คุณคือผู้บุกเบิกแนวคิด "อร่อย ตาม ลำดับ" (Delicious in Order)

บุคลิกของคุณ:
- เป็นกันเอง ใจดี เหมือนพี่สาวที่หวังดีและอยากให้ทุกคนสุขภาพดีไปนานๆ
- เข้าใจและเห็นใจคนรักอาหาร ("เข้าใจเลยว่าชานมไข่มุกมันอร่อย!")
- ไม่เคยห้ามกินอะไร แต่จะบอกว่า "กินยังไงให้ปลอดภัยและไม่แก่"

หลักการแนะนำ (ปรัชญา "อร่อย ตาม ลำดับ"):
1. **ลำดับการกินสำคัญที่สุด**: แนะนำให้กิน ผัก (ใยอาหาร) ➔ โปรตีนและไขมัน ➔ คาร์โบไฮเดรต ➔ ของหวาน (ถ้ามี)
2. **คุมน้ำตาล ไม่ใช่ตัดน้ำตาล**: เน้นการลด Glucose Spike เพื่อป้องกันการอักเสบและความแก่ (AGEs)
3. **กิจกรรมหลังมื้ออาหาร**: แนะนำให้เดิน 10-15 นาทีหลังมื้อใหญ่เพื่อช่วยกล้ามเนื้อดึงน้ำตาลไปใช้
4. **ระวัง UPF**: เตือนเกี่ยวกับอาหารแปรรูปสูงที่มักแฝงน้ำตาลและสารเคมี
5. **สุขภาพลำไส้**: สนับสนุนการกินอาหารที่มีโปรไบโอติกส์ เช่น กิมจิ นัตโตะ หรือผักดองไทย
"""
        else:
            prompt = """
You are "Shinny", a nutrition expert and the creator of the "อยู่เพื่อกินบำนาญ" (Living to eat your pension / Live long to eat well) movement.
You are the pioneer of the "Delicious in Order" (อร่อย ตาม ลำดับ) methodology.

Your Personality:
- Friendly, empathetic, and supportive—like a wise older sister who wants you to stay healthy forever.
- Understands food cravings ("We know that bubble tea is irresistible!")
- Never strictly prohibits any food; instead, you teach "how to eat it safely and avoid premature aging."

Your Core Principles ("Delicious in Order"):
1. **Food Sequencing is Key**: Always recommend Veggies (Fiber) ➔ Protein & Fat ➔ Carbs ➔ Sweets.
2. **Manage Sugar, Don't Just Quit It**: Focus on flattening Glucose Spikes to prevent inflammation and aging (AGEs).
3. **Post-meal Activity**: Suggest a 10-15 min walk after big meals to help muscles use up the glucose.
4. **UPF Awareness**: Warn about Ultra-Processed Foods that hide sugars and additives.
5. **Gut Health**: Encourage probiotics like Kimchi, Natto, or fermented Thai foods.
"""

        if context:
            prompt += self._format_user_context(language, context)
        return prompt

    @staticmethod
    def _format_user_context(language: str, context: Mapping[str, Any]) -> str:
        """Append user context lines (recent scan, goal, restrictions) to the prompt."""
        is_thai = language == "th"
        labels = {
            "header": "\n\nข้อมูลผู้ใช้:\n" if is_thai else "\n\nUser context:\n",
            "recent_scan": "- เพิ่งสแกนอาหาร: " if is_thai else "- Recent scan: ",
            "user_goal": "- เป้าหมาย: " if is_thai else "- Goal: ",
            "restrictions": "- ข้อจำกัดด้านอาหาร: " if is_thai else "- Dietary restrictions: ",
        }
        out = labels["header"]
        if context.get("recent_scan"):
            out += f"{labels['recent_scan']}{context['recent_scan']}\n"
        if context.get("user_goal"):
            out += f"{labels['user_goal']}{context['user_goal']}\n"
        if context.get("dietary_restrictions"):
            out += f"{labels['restrictions']}{', '.join(context['dietary_restrictions'])}\n"
        return out

    def _create_recipe_suggestion_prompt(
        self,
        ingredients: List[str],
        dietary_restrictions: Optional[List[str]],
        language: str,
    ) -> str:
        """Build the recipe-suggestion prompt."""
        ingredients_str = ", ".join(ingredients)
        if language == "th":
            restrictions_str = ", ".join(dietary_restrictions) if dietary_restrictions else "ไม่มี"
            return f"""
จากวัตถุดิบเหล่านี้: {ingredients_str}
ข้อจำกัด: {restrictions_str}

แนะนำสูตรอาหาร 3-5 รายการ โดยให้ข้อมูลในรูปแบบ JSON:

{{
  "recipes": [
    {{
      "name_th": "ชื่ออาหาร",
      "name_en": "Recipe name",
      "description_th": "คำอธิบายสั้นๆ",
      "required_ingredients": ["ส่วนประกอบที่ต้องใช้"],
      "optional_ingredients": ["ส่วนประกอบเสริม"],
      "difficulty": "easy/medium/hard",
      "prep_time_minutes": 15,
      "is_thai_recipe": true,
      "health_score": 85,
      "why_recommended": "เหตุผลที่แนะนำ"
    }}
  ]
}}

ให้ความสำคัญกับอาหารไทยที่มีประโยชน์ต่อสุขภาพ
"""
        restrictions_str = ", ".join(dietary_restrictions) if dietary_restrictions else "None"
        return f"""
Given these ingredients: {ingredients_str}
Restrictions: {restrictions_str}

Suggest 3-5 recipes in JSON format:

{{
  "recipes": [
    {{
      "name_th": "Thai name",
      "name_en": "English name",
      "description_en": "Brief description",
      "required_ingredients": ["essential ingredients"],
      "optional_ingredients": ["optional additions"],
      "difficulty": "easy/medium/hard",
      "prep_time_minutes": 15,
      "is_thai_recipe": true,
      "health_score": 85,
      "why_recommended": "Why this recipe is good"
    }}
  ]
}}

Prioritize healthy Thai recipes when possible.
"""

    # ------------------------------------------------------------------
    # Response parsing
    # ------------------------------------------------------------------
    @staticmethod
    def _extract_json_text(response_text: str) -> Optional[str]:
        """
        Extract a JSON payload from a possibly markdown-wrapped LLM response.

        Strategy:
        1. Try a fenced block ```json ... ``` or ``` ... ```.
        2. Fall back to the first {...} / [...] in the text.
        3. Give up (return None) if neither is found.
        """
        if not response_text:
            return None

        fence = _FENCED_JSON_RE.search(response_text)
        if fence:
            return fence.group(1).strip()

        bare = _BARE_JSON_RE.search(response_text)
        if bare:
            return bare.group(1).strip()

        stripped = response_text.strip()
        return stripped or None

    @classmethod
    def _parse_json_response(
        cls,
        response_text: str,
        fallback: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Parse a JSON response, returning `fallback` (+ raw text) on failure."""
        json_text = cls._extract_json_text(response_text)
        if json_text is None:
            logger.error("Empty Gemini response")
            return {**(fallback or {}), "raw_response": response_text}

        try:
            return json.loads(json_text)
        except json.JSONDecodeError as exc:
            logger.error(
                "Failed to parse JSON response: %s | raw (first 500 chars): %s",
                exc,
                response_text[:500],
            )
            return {**(fallback or {}), "raw_response": response_text}


# Global instance (kept for backward compatibility with existing callers).
gemini_service = GeminiService()
