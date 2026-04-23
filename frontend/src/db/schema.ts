import { sqliteTable, text, integer, real, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
    id: text('id').primaryKey(),
    email: text('email').notNull().unique(),
    displayName: text('display_name'),
    hashedPassword: text('hashed_password'),
    subscriptionTier: text('subscription_tier').default('free'), // free, premium, family
    trialExpiresAt: integer('trial_expires_at', { mode: 'timestamp' }),
    promoSource: text('promo_source'), // code that activated current tier
    language: text('language').default('th'),
    healthInfo: text('health_info', { mode: 'json' }), // age, weight, height, goals
    usageTracking: text('usage_tracking', { mode: 'json' }),
    scansThisMonth: integer('scans_this_month').default(0),
    streakDays: integer('streak_days').default(0),
    totalPoints: integer('total_points').default(0),
    // Admin role flag, separate from subscriptionTier so admin status
    // doesn't get confused with billing tier. Stored as 0/1 in SQLite.
    // Gates access to /admin/* routes (added later) — DO NOT expose
    // this in any public profile API response.
    isAdmin: integer('is_admin', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const promoCodes = sqliteTable('promo_codes', {
    id: text('id').primaryKey(),
    code: text('code').notNull().unique(),
    type: text('type').notNull(), // TRIAL, DISCOUNT, FANCLUB, REFERRAL
    description: text('description'),
    descriptionTh: text('description_th'),
    trialDays: integer('trial_days'),
    discountPercent: real('discount_percent'),
    grantTier: text('grant_tier').default('premium'),
    usageLimit: integer('usage_limit').default(100),
    usageCount: integer('usage_count').default(0),
    isActive: integer('is_active', { mode: 'boolean' }).default(true),
    expiresAt: integer('expires_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const codeRedemptions = sqliteTable(
    'code_redemptions',
    {
        id: text('id').primaryKey(),
        userId: text('user_id').references(() => users.id),
        codeId: text('code_id').references(() => promoCodes.id),
        benefitsApplied: text('benefits_applied', { mode: 'json' }),
        redeemedAt: integer('redeemed_at', { mode: 'timestamp' }).notNull(),
    },
    // Enforce "one redemption per (user, code)" at the DB level so the
    // API-level check-then-insert race can't double-grant benefits. The
    // route handler catches the constraint violation and translates it
    // to the same "already redeemed" user-facing error.
    (t) => ({
        userCodeUnique: uniqueIndex('code_redemptions_user_code_unique').on(
            t.userId,
            t.codeId,
        ),
    }),
);

export const sessions = sqliteTable('sessions', {
    id: text('id').primaryKey(),
    userId: text('user_id').references(() => users.id),
    token: text('token').notNull().unique(),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
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
    modelUsed: text('model_used'),
    scanMode: text('scan_mode'), // meal, menu, drink_snack
    errorClass: text('error_class'), // null = success, else: timeout, parse_error, model_error, etc.
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
