"""
Google Gemini AI service for image recognition and chat.
Handles ingredient detection, nutritional analysis, and conversational AI.
"""
import base64
import json
import logging
from typing import Dict, List, Optional, Any
from pathlib import Path
import google.generativeai as genai
from PIL import Image

from app.core.config import settings

logger = logging.getLogger(__name__)

# Configure Gemini API
genai.configure(api_key=settings.GEMINI_API_KEY)


class GeminiService:
    """Service for interacting with Google Gemini AI."""

    def __init__(self):
        """Initialize Gemini service."""
        self.model_name = settings.GEMINI_MODEL
        self.generation_config = {
            "temperature": settings.GEMINI_TEMPERATURE,
            "max_output_tokens": settings.GEMINI_MAX_TOKENS,
        }

    async def analyze_food_image(
        self,
        image_path: str,
        language: str = "th"
    ) -> Dict[str, Any]:
        """
        Analyze a food image and extract nutritional information.

        Args:
            image_path: Path to the image file
            language: Response language (th or en)

        Returns:
            Dictionary containing detected items, nutrition, and scores
        """
        try:
            # Load image
            img = Image.open(image_path)

            # Create model
            model = genai.GenerativeModel(
                model_name=self.model_name,
                generation_config=self.generation_config
            )

            # Create prompt based on language
            prompt = self._create_food_analysis_prompt(language)

            # Generate response
            response = model.generate_content([prompt, img])

            # Parse response
            result = self._parse_food_analysis_response(response.text)

            logger.info(f"Successfully analyzed food image: {image_path}")
            return result

        except Exception as e:
            logger.error(f"Error analyzing food image: {str(e)}")
            raise

    def _create_food_analysis_prompt(self, language: str) -> str:
        """Create prompt for food analysis based on language."""

        if language == "th":
            return """
วิเคราะห์อาหารในภาพนี้และให้ข้อมูลโดยละเอียดในรูปแบบ JSON ดังนี้:

{
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
    "processing_level": "minimally_processed"
  },
  "thai_food_context": {
    "regional_origin": "ภาคกลาง/อีสาน/เหนือ/ใต้",
    "traditional_benefits": "ประโยชน์ตามความเชื่อไทย",
    "eating_recommendations": "คำแนะนำการรับประทาน"
  }
}

สำคัญ: ถ้าเป็นอาหารไทย กรุณาระบุข้อมูลเฉพาะของอาหารไทย เช่น ส่วนประกอบตามสูตรไทย น้ำตาลในน้ำจิ้ม เป็นต้น
"""
        else:  # English
            return """
Analyze the food in this image and provide detailed information in JSON format:

{
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
    "sugar_g": 5
  },
  "ingredients": [
    {
      "name_th": "Thai ingredient name",
      "name_en": "English ingredient name",
      "estimated_amount": "100g"
    }
  ],
  "health_insights": {
    "glycemic_load": 25,
    "is_high_fiber": true,
    "is_high_protein": false,
    "contains_vegetables": true,
    "processing_level": "minimally_processed"
  },
  "thai_food_context": {
    "regional_origin": "Central/Isan/Northern/Southern",
    "traditional_benefits": "Traditional Thai health benefits",
    "eating_recommendations": "How to eat for best health"
  }
}

Important: If this is Thai food, include specific Thai food context such as traditional ingredients, sugar in dipping sauces, etc.
"""

    def _parse_food_analysis_response(self, response_text: str) -> Dict[str, Any]:
        """Parse Gemini response into structured data."""
        try:
            # Extract JSON from response (handle markdown code blocks)
            json_text = response_text
            if "```json" in json_text:
                json_text = json_text.split("```json")[1].split("```")[0]
            elif "```" in json_text:
                json_text = json_text.split("```")[1].split("```")[0]

            # Parse JSON
            data = json.loads(json_text.strip())
            return data

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON response: {str(e)}")
            # Return fallback structure
            return {
                "detected_items": [],
                "nutrition_summary": {},
                "ingredients": [],
                "health_insights": {},
                "thai_food_context": {},
                "raw_response": response_text
            }

    async def chat_nutrition_question(
        self,
        question: str,
        chat_history: Optional[List[Dict[str, str]]] = None,
        language: str = "th",
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Answer nutrition-related questions using Gemini AI.

        Args:
            question: User's question
            chat_history: Previous chat messages
            language: Response language (th or en)
            context: Optional context (recent scans, user preferences)

        Returns:
            Dictionary with answer and metadata
        """
        try:
            # Create model
            model = genai.GenerativeModel(
                model_name=self.model_name,
                generation_config=self.generation_config
            )

            # Build system prompt
            system_prompt = self._create_chat_system_prompt(language, context)

            # Build conversation history
            messages = []
            if chat_history:
                for msg in chat_history[-10:]:  # Last 10 messages for context
                    messages.append(f"{msg['role']}: {msg['content']}")

            # Add current question
            full_prompt = f"{system_prompt}\n\n"
            if messages:
                full_prompt += "Previous conversation:\n" + "\n".join(messages) + "\n\n"
            full_prompt += f"User: {question}\nAssistant:"

            # Generate response
            response = model.generate_content(full_prompt)

            result = {
                "answer": response.text,
                "model_used": self.model_name,
                "language": language,
                "has_context": context is not None
            }

            logger.info(f"Successfully answered nutrition question in {language}")
            return result

        except Exception as e:
            logger.error(f"Error in chat: {str(e)}")
            raise

    def _create_chat_system_prompt(
        self,
        language: str,
        context: Optional[Dict[str, Any]] = None
    ) -> str:
        """Create system prompt for chat based on language and context."""

        if language == "th":
            prompt = """
คุณคือผู้เชี่ยวชาญด้านโภชนาการที่ให้คำปรึกษาแบบมิตรและเข้าใจง่าย
โดยเฉพาะอย่างยิ่งเกี่ยวกับอาหารไทยและวิถีชีวิตของคนไทย

หลักการตอบคำถาม:
1. ใช้ภาษาที่เข้าใจง่าย หลีกเลี่ยงศัพท์วิชาการมากเกินไป
2. ให้คำแนะนำที่ปฏิบัติได้จริง ไม่เข้มงวดจนเกินไป
3. เน้น "อยู่ได้นานพร้อมกับกินอาหารอร่อย" มากกว่าการห้ามเด็ดขาด
4. อ้างอิงหลักฐานทางวิทยาศาสตร์เมื่อเป็นไปได้
5. คำนึงถึงบริบทอาหารไทย เช่น ข้าวเหนียว น้ำตาลในอาหาร น้ำพริก เป็นต้น

หัวข้อที่เชี่ยวชาญ:
- การจัดการน้ำตาลในเลือด (สำคัญมากสำหรับคนไทย)
- ลำดับการทานอาหาร (ผัก → โปรตีน → ไขมัน → คาร์โบไฮเดรต → ของหวาน)
- Glycemic Index และผลกระทบของอาหารไทย
- สุขภาพลำไส้และอาหารหมัก
- โภชนาการสมัยใหม่และการต้านการอักเสบ
- วิตามินและแร่ธาตุจากอาหารไทย
"""
        else:  # English
            prompt = """
You are a friendly and knowledgeable nutrition expert, specializing in Thai food and lifestyle.

Guidelines for answering:
1. Use simple, accessible language avoiding excessive jargon
2. Provide practical, actionable advice that's not overly restrictive
3. Focus on "live long while eating well" rather than strict prohibition
4. Reference scientific evidence when possible
5. Consider Thai food context: sticky rice, sugar in dishes, Thai condiments, etc.

Areas of expertise:
- Blood sugar management (very important for Thai population)
- Food sequencing (vegetables → protein → fat → carbs → sweets)
- Glycemic Index and impact of Thai foods
- Gut health and fermented foods
- Modern nutrition and anti-inflammatory eating
- Vitamins and minerals from Thai ingredients
"""

        # Add context if available
        if context:
            if language == "th":
                prompt += "\n\nข้อมูลผู้ใช้:\n"
                if context.get("recent_scan"):
                    prompt += f"- เพิ่งสแกนอาหาร: {context['recent_scan']}\n"
                if context.get("user_goal"):
                    prompt += f"- เป้าหมาย: {context['user_goal']}\n"
                if context.get("dietary_restrictions"):
                    prompt += f"- ข้อจำกัดด้านอาหาร: {', '.join(context['dietary_restrictions'])}\n"
            else:
                prompt += "\n\nUser context:\n"
                if context.get("recent_scan"):
                    prompt += f"- Recent scan: {context['recent_scan']}\n"
                if context.get("user_goal"):
                    prompt += f"- Goal: {context['user_goal']}\n"
                if context.get("dietary_restrictions"):
                    prompt += f"- Dietary restrictions: {', '.join(context['dietary_restrictions'])}\n"

        return prompt

    async def generate_recipe_suggestions(
        self,
        ingredients: List[str],
        dietary_restrictions: Optional[List[str]] = None,
        language: str = "th"
    ) -> Dict[str, Any]:
        """
        Generate recipe suggestions based on available ingredients.

        Args:
            ingredients: List of available ingredients
            dietary_restrictions: Optional dietary restrictions
            language: Response language

        Returns:
            Dictionary with recipe suggestions
        """
        try:
            model = genai.GenerativeModel(
                model_name=self.model_name,
                generation_config=self.generation_config
            )

            prompt = self._create_recipe_suggestion_prompt(
                ingredients,
                dietary_restrictions,
                language
            )

            response = model.generate_content(prompt)

            # Parse response
            result = self._parse_recipe_suggestions(response.text)

            logger.info(f"Generated recipe suggestions for {len(ingredients)} ingredients")
            return result

        except Exception as e:
            logger.error(f"Error generating recipes: {str(e)}")
            raise

    def _create_recipe_suggestion_prompt(
        self,
        ingredients: List[str],
        dietary_restrictions: Optional[List[str]],
        language: str
    ) -> str:
        """Create prompt for recipe suggestions."""

        ingredients_str = ", ".join(ingredients)
        restrictions_str = ", ".join(dietary_restrictions) if dietary_restrictions else "ไม่มี"

        if language == "th":
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
        else:
            return f"""
Given these ingredients: {ingredients_str}
Restrictions: {restrictions_str if dietary_restrictions else "None"}

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

    def _parse_recipe_suggestions(self, response_text: str) -> Dict[str, Any]:
        """Parse recipe suggestion response."""
        try:
            # Extract JSON
            json_text = response_text
            if "```json" in json_text:
                json_text = json_text.split("```json")[1].split("```")[0]
            elif "```" in json_text:
                json_text = json_text.split("```")[1].split("```")[0]

            data = json.loads(json_text.strip())
            return data

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse recipe suggestions: {str(e)}")
            return {
                "recipes": [],
                "raw_response": response_text
            }


# Global instance
gemini_service = GeminiService()
