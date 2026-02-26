# Shinny Avatar Creation Guide

This document outlines the principles for recreating the Shinny Avatar for use in the Nutri-Vision AI page and app.

## Goal
To replace the standard text emoji (👩‍🏫) with a custom, realistic but friendly AI Avatar that closely resembles Shinny's actual appearance, providing an Optimal UX and consistent brand identity.

## Reference Images
The avatar is generated based on the portrait images located in:
`research\Shinny\Profile\Portrait\`
- `Shinny_Portrait1.jpg`
- `Shinny_Portrait2.jpg`
- `Shinny_Portrait3.jpg`

## Generation Method
We use an AI image generation model (like Google Banana or standard text-to-image AI tools supporting image prompts) with the following parameters:

**Prompt:**
> Create a 2D or 3D animated-style friendly avatar character that closely resembles the person in the provided photos. The avatar should have a warm, welcoming expression, suitable for a health and nutrition app guide. She should look like a helpful, friendly AI assistant or human guide, with a clear modern aesthetic, vibrant colors, clear features, and a transparent or plain background to be used as an avatar icon. Use a friendly animated styling.

## Usage in App
The Avatar is exported as a transparent or cleanly cropped image (e.g., `shinny_avatar.png`), stored in `frontend/public/images/`.

In the application, utilize standard image components with rounding and borders to ensure the avatar blends correctly with the UI:
```tsx
<img 
  src="/images/shinny_avatar.png" 
  alt="Shinny" 
  className="w-8 h-8 rounded-full border-2 border-white shadow-sm" 
/>
```

## Postures

To provide an Optimal UX, we use different postures for Shinny based on the context:

1. **Standard (`shinny_avatar.png`)**: Warm, welcoming expression for general greetings (Home page).
2. **Analyzing (`shinny_avatar_analyzing.png`)**: Looking closely, thinking, or examining something. Used when the AI is processing food images. Prompts should include keywords like "Analyzing, looking closely, thinking, examining, holding a magnifying glass".
3. **Explaining (`shinny_avatar_explaining.png`)**: Pointing or guiding. Used when providing tips or tutorials (Demo page, Scan tips). Prompts should include keywords like "Explaining, pointing to the side or front, helpful guiding expression".
4. **Celebrating (`shinny_avatar_celebrating.png`)**: Happy, cheering. Used for successful scans, high scores, or gamification achievements. Prompts should include keywords like "Celebrating, very happy, cheering, hands up in excitement".

## Animation and Future Improvements
For an *"Optimal UX"* in the future:
1.  **Multiple Expressions:** Generate multiple versions of the avatar (happy, thinking/analyzing, pointing) to swap during different app states (e.g., when the app says "Shinny is analyzing your food...").
2.  **Lottie Animations:** Convert the expression changes to SVG or Lottie animations if possible, allowing dynamic interaction.
3.  **Chat UI Elements:** The avatar should serve as the profile picture in Chat interfaces or tooltips where Shinny provides dietary advice.
