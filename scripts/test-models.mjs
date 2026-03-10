import fs from 'fs';
import path from 'path';

const GOOGLE_API_KEY = 'AIzaSyCIroGys7PyhPYZTlqKPtCMySltEaXvKDo';
const PROD_API_URL = 'https://shinnyguide.autobahn.bot/api/analyze';

const AI_PROMPT = `You are a food identification and nutrition expert. Analyze this image carefully.
CRITICAL RULES:
1. FIRST identify what is actually in the image. Do NOT assume it is a prepared dish.
2. The image may contain: raw fruits, raw vegetables, whole ingredients, snacks, prepared meals, beverages, or non-food items.
3. Only list ingredients/items that are ACTUALLY VISIBLE in the image. Do NOT hallucinate items that are not there.
4. If the image shows a single raw fruit or vegetable, identify it as such (e.g., "Pineapple", "Banana", "Mango").
5. If the image shows MULTIPLE items, list ALL of them separately (e.g., "Pineapple" and "Artichokes").
6. If the image does NOT contain food, set isFood to false.
7. Estimate nutrition per typical serving size visible in the image.
8. Set confidence 0-100 based on how clearly you can identify the food. If uncertain, use a LOW confidence score.

Respond ONLY with a valid JSON object (no markdown, no explanation, no code fences) matching this schema:
{"isFood":true,"foodName":"Name of the dish or ingredient","foodCategory":"fruit|vegetable|prepared_dish|snack|beverage|dessert|other","detectedItems":["🍍 Item 1","🥕 Item 2"],"nutritionSummary":{"calories":0,"protein":0,"carbs":0,"fat":0,"fiber":0},"scores":{"bloodSugar":0,"gutHealth":0,"inflammation":0,"nutrientDensity":0,"processing":0,"proteinQuality":0,"micronutrient":0},"sequence":["1. Fiber/Veggies first","2. Protein/Fat","3. Carbs","4. Sweets"],"tip":"One short helpful tip.","confidence":0}`;

async function testGemmaDirectly(base64Data, filename) {
    console.log(`\n🤖 Testing Google Gemma 3 27B directly for ${filename}...`);
    const model = 'gemma-3-27b-it';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GOOGLE_API_KEY}`;
    
    const payload = {
        contents: [{
            parts: [
                { text: AI_PROMPT + '\n\nIMPORTANT: Respond with ALL text values in English.' },
                { inline_data: { mime_type: 'image/jpeg', data: base64Data } }
            ]
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 1024 }
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) throw new Error(`Google API Error: ${response.status} ${await response.text()}`);
        const data = await response.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        const result = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
        console.log(`✅ Gemma 3 27B Result (${result.confidence}% confidence): ${result.foodName}`);
        console.log(`   Items: ${result.detectedItems.join(', ')}`);
        return result;
    } catch (e) {
        console.error(`❌ Gemma 3 Error:`, e.message);
    }
}

async function testProductionAPI(base64Data, filename) {
    console.log(`\n🌍 Testing Production API (Cloudflare 11B -> Gemma 3 Fallback) for ${filename}...`);
    try {
        const response = await fetch(PROD_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                imageBase64: `data:image/jpeg;base64,${base64Data}`,
                locale: 'en'
            })
        });
        
        const rawText = await response.text();
        try {
            const data = JSON.parse(rawText);
            if (!response.ok) throw new Error(JSON.stringify(data));
            console.log(`✅ Prod API Result (${data.confidence}% confidence): ${data.result.foodName}`);
            console.log(`   Items: ${data.result.detectedItems.join(', ')}`);
            return data.result;
        } catch (parseErr) {
            console.error(`❌ Prod API Error (Status ${response.status}):\n`, rawText.substring(0, 500));
        }
    } catch (e) {
        console.error(`❌ Prod API Fetch Error:`, e.message);
    }
}

async function runTests() {
    const dir = path.join(process.cwd(), 'research', 'test-image');
    const files = fs.readdirSync(dir).filter(f => f.match(/\.(jpg|jpeg|png)$/i));
    
    console.log(`Found ${files.length} images to test.\n`);
    
    for (const file of files) {
        console.log(`====================================================`);
        console.log(`📸 Image: ${file}`);
        console.log(`====================================================`);
        const filePath = path.join(dir, file);
        const imageBuffer = fs.readFileSync(filePath);
        const base64Data = imageBuffer.toString('base64');
        
        await testGemmaDirectly(base64Data, file);
        await testProductionAPI(base64Data, file);
    }
}

runTests();
