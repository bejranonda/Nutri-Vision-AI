import fs from 'fs';
import path from 'path';

async function testScan() {
    const imagePath = path.join(process.cwd(), 'research', 'test-image', 'pineapple.jpg');
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;

    const url = 'https://shinnyguide.autobahn.bot/api/analyze';
    
    console.log(`Sending request to ${url}...`);
    console.log(`Image size: ${(imageBuffer.length / 1024).toFixed(1)} KB`);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                imageBase64: base64Image,
                locale: 'en'
            })
        });

        const rawText = await response.text();
        let data;
        try {
            data = JSON.parse(rawText);
        } catch (e) {
            console.error('Failed to parse JSON. Raw response:');
            console.log(rawText.substring(0, 1000));
            return;
        }
        console.log(`Status: ${response.status} ${response.statusText}`);
        console.log('Response:', JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error during fetch:', error);
    }
}

testScan();
