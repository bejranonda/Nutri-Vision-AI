"""
Seed database with Thai food data.
Sample recipes and ingredients for initial setup.
"""
from sqlalchemy.orm import Session
from app.models.food import Recipe, Ingredient
from app.db.base import SessionLocal


def seed_thai_recipes():
    """Add sample Thai recipes to database."""
    db = SessionLocal()

    recipes = [
        {
            "name_th": "ส้มตำไทย",
            "name_en": "Thai Papaya Salad (Som Tam)",
            "description_th": "อาหารยอดนิยมภาคอีสาน สดชื่น เผ็ดร้อน",
            "description_en": "Popular Thai salad from Isan region, fresh and spicy",
            "ingredients": [
                {"name": "มะละกอดิบ", "amount": "2 ถ้วย"},
                {"name": "มะเขือเทศ", "amount": "3 ลูก"},
                {"name": "ถั่วฝักยาว", "amount": "5 เส้น"},
                {"name": "พริกขี้หนู", "amount": "3-5 เม็ด"},
                {"name": "กระเทียม", "amount": "2 กลีบ"},
                {"name": "น้ำปลา", "amount": "2 ช้อนโต๊ะ"},
                {"name": "น้ำมะนาว", "amount": "2 ช้อนโต๊ะ"},
                {"name": "น้ำตาลปี๊บ", "amount": "1 ช้อนโต๊ะ"}
            ],
            "instructions_th": [
                "ตำกระเทียมและพริกพอแหลก",
                "ใส่ถั่วฝักยาวตำพอแตก",
                "ใส่มะละกอและมะเขือเทศ",
                "ปรุงรสด้วยน้ำปลา น้ำมะนาว น้ำตาล",
                "ตำให้เข้ากัน ชิมรส เสิร์ฟ"
            ],
            "instructions_en": [
                "Pound garlic and chilies until crushed",
                "Add long beans and pound lightly",
                "Add papaya and tomatoes",
                "Season with fish sauce, lime juice, and sugar",
                "Mix well, taste, and serve"
            ],
            "prep_time_minutes": 15,
            "cook_time_minutes": 0,
            "servings": 2,
            "cuisine": "thai",
            "category": "salad",
            "is_vegetarian": False,
            "is_vegan": False,
            "is_halal": False,
            "is_diabetic_friendly": True,
            "is_low_carb": True,
            "calories_per_serving": 120,
            "protein_g": 3,
            "carbs_g": 25,
            "fat_g": 1,
            "fiber_g": 4,
            "blood_sugar_score": 85,
            "gut_health_score": 90,
            "inflammation_score": 88,
            "nutrient_density_score": 92,
            "processing_level_score": 95,
            "protein_quality_score": 40,
            "micronutrient_score": 85,
            "overall_health_score": 85,
            "is_published": True,
            "is_featured": True,
        },
        {
            "name_th": "ต้มยำกุ้ง",
            "name_en": "Tom Yum Goong (Spicy Shrimp Soup)",
            "description_th": "ซุปรสเปรี้ยวเผ็ดเด็ดเดี่ยว อาหารไทยระดับโลก",
            "description_en": "World-famous Thai hot and sour soup",
            "ingredients": [
                {"name": "กุ้งแม่น้ำ", "amount": "300 กรัม"},
                {"name": "ข่า", "amount": "50 กรัม"},
                {"name": "ตะไคร้", "amount": "3 ต้น"},
                {"name": "ใบมะกรูด", "amount": "5 ใบ"},
                {"name": "พริกขี้หนู", "amount": "5 เม็ด"},
                {"name": "เห็ดฟาง", "amount": "100 กรัม"},
                {"name": "มะนาว", "amount": "3 ลูก"},
                {"name": "น้ำปลา", "amount": "3 ช้อนโต๊ะ"}
            ],
            "instructions_th": [
                "ต้มน้ำให้เดือด ใส่ข่า ตะไคร้ ใบมะกรูด",
                "ใส่กุ้งและเห็ด",
                "ปรุงรสด้วยน้ำปลา น้ำมะนาว",
                "ชิมรส เสิร์ฟร้อนๆ"
            ],
            "instructions_en": [
                "Boil water, add galangal, lemongrass, kaffir lime leaves",
                "Add shrimp and mushrooms",
                "Season with fish sauce and lime juice",
                "Taste and serve hot"
            ],
            "prep_time_minutes": 10,
            "cook_time_minutes": 15,
            "servings": 4,
            "cuisine": "thai",
            "category": "soup",
            "is_vegetarian": False,
            "is_vegan": False,
            "is_halal": False,
            "is_diabetic_friendly": True,
            "is_low_carb": True,
            "calories_per_serving": 150,
            "protein_g": 20,
            "carbs_g": 8,
            "fat_g": 3,
            "fiber_g": 2,
            "blood_sugar_score": 90,
            "gut_health_score": 75,
            "inflammation_score": 92,
            "nutrient_density_score": 88,
            "processing_level_score": 95,
            "protein_quality_score": 95,
            "micronutrient_score": 80,
            "overall_health_score": 88,
            "is_published": True,
            "is_featured": True,
        },
    ]

    for recipe_data in recipes:
        recipe = Recipe(**recipe_data)
        db.add(recipe)

    db.commit()
    print(f"Added {len(recipes)} Thai recipes to database")
    db.close()


def seed_thai_ingredients():
    """Add common Thai ingredients to database."""
    db = SessionLocal()

    ingredients = [
        {
            "name_th": "มะละกอดิบ",
            "name_en": "Green Papaya",
            "category": "vegetable",
            "is_thai_ingredient": True,
            "calories": 43,
            "protein_g": 0.5,
            "carbs_g": 11,
            "fat_g": 0.3,
            "fiber_g": 1.7,
            "glycemic_index": 60,
            "vitamin_c": 62,
            "vitamin_a": 22,
        },
        {
            "name_th": "ข่า",
            "name_en": "Galangal",
            "category": "herb",
            "is_thai_ingredient": True,
            "calories": 71,
            "protein_g": 1,
            "carbs_g": 15,
            "fiber_g": 2,
            "is_prebiotic": False,
            "antioxidant_orac": 3500,
        },
        {
            "name_th": "ตะไคร้",
            "name_en": "Lemongrass",
            "category": "herb",
            "is_thai_ingredient": True,
            "calories": 99,
            "protein_g": 1.8,
            "carbs_g": 25,
            "fiber_g": 3,
            "antioxidant_orac": 2500,
        },
        {
            "name_th": "ใบมะกรูด",
            "name_en": "Kaffir Lime Leaves",
            "category": "herb",
            "is_thai_ingredient": True,
            "calories": 30,
            "vitamin_c": 35,
            "antioxidant_orac": 3000,
        },
        {
            "name_th": "กุ้ง",
            "name_en": "Shrimp",
            "category": "protein",
            "is_thai_ingredient": False,
            "calories": 99,
            "protein_g": 24,
            "carbs_g": 0.2,
            "fat_g": 0.3,
            "fiber_g": 0,
            "omega3_mg": 315,
            "omega6_mg": 15,
        },
    ]

    for ingredient_data in ingredients:
        ingredient = Ingredient(**ingredient_data)
        db.add(ingredient)

    db.commit()
    print(f"Added {len(ingredients)} Thai ingredients to database")
    db.close()


if __name__ == "__main__":
    print("Seeding database with Thai food data...")
    seed_thai_ingredients()
    seed_thai_recipes()
    print("Database seeded successfully!")
