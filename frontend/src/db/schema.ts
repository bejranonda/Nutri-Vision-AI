import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
    id: text('id').primaryKey(),
    email: text('email').notNull().unique(),
    hashedPassword: text('hashed_password'),
    subscriptionTier: text('subscription_tier').default('free'), // free, premium, family
    language: text('language').default('th'),
    healthInfo: text('health_info', { mode: 'json' }), // age, weight, height, goals
    usageTracking: text('usage_tracking', { mode: 'json' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const foodScans = sqliteTable('food_scans', {
    id: text('id').primaryKey(),
    userId: text('user_id').references(() => users.id),
    imageUrl: text('image_url'),
    detectedItems: text('detected_items', { mode: 'json' }),
    nutritionSummary: text('nutrition_summary', { mode: 'json' }),
    scoreBloodSugar: real('score_blood_sugar'),
    scoreGutHealth: real('score_gut_health'),
    scoreInflammation: real('score_inflammation'),
    scoreNutrientDensity: real('score_nutrient_density'),
    scoreProcessing: real('score_processing'),
    scoreProteinQuality: real('score_protein_quality'),
    scoreMicronutrient: real('score_micronutrient'),
    scoreOverall: real('score_overall'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const recipes = sqliteTable('recipes', {
    id: text('id').primaryKey(),
    nameTh: text('name_th').notNull(),
    nameEn: text('name_en').notNull(),
    ingredients: text('ingredients', { mode: 'json' }),
    instructionsTh: text('instructions_th'),
    instructionsEn: text('instructions_en'),
    nutritionPerServing: text('nutrition_per_serving', { mode: 'json' }),
    dietaryFlags: text('dietary_flags', { mode: 'json' }), // vegetarian, halal, etc.
    scoreOverall: real('score_overall'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const ingredients = sqliteTable('ingredients', {
    id: text('id').primaryKey(),
    nameTh: text('name_th').notNull(),
    nameEn: text('name_en').notNull(),
    category: text('category'),
    nutritionPer100g: text('nutrition_per_100g', { mode: 'json' }),
    glycemicIndex: real('glycemic_index'),
    specialProperties: text('special_properties', { mode: 'json' }),
});

export const chatMessages = sqliteTable('chat_messages', {
    id: text('id').primaryKey(),
    userId: text('user_id').references(() => users.id),
    role: text('role').notNull(), // user or assistant
    content: text('content').notNull(),
    language: text('language'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});
