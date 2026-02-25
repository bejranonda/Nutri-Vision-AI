import fs from 'fs';
import path from 'path';

const ASSETS_DIR = '.open-next/assets';

console.log("Preparing assets for Cloudflare Pages...");

// Copy worker.js as _worker.js
if (fs.existsSync('.open-next/worker.js')) {
    fs.copyFileSync('.open-next/worker.js', path.join(ASSETS_DIR, '_worker.js'));
}

// Function to copy directory recursively
function copyDir(src, dest) {
    if (!fs.existsSync(src)) return;
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (let entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

// Copy dependencies
copyDir('.open-next/cloudflare', path.join(ASSETS_DIR, 'cloudflare'));
copyDir('.open-next/middleware', path.join(ASSETS_DIR, 'middleware'));
copyDir('.open-next/.build', path.join(ASSETS_DIR, '.build'));
copyDir('.open-next/server-functions', path.join(ASSETS_DIR, 'server-functions'));

// Create _routes.json for Cloudflare Pages Functions routing
const routes = {
    version: 1,
    include: ["/*"],
    exclude: [
        "/_next/static/*",
        "/favicon.ico",
        "/robots.txt",
        "/sitemap.xml",
        "/*.png",
        "/*.jpg",
        "/*.jpeg",
        "/*.gif",
        "/*.svg",
        "/*.ico",
        "/*.webp"
    ]
};

fs.writeFileSync(path.join(ASSETS_DIR, '_routes.json'), JSON.stringify(routes, null, 2));

console.log("Assets prepared successfully!");

// Count files
function countFiles(dir) {
    if (!fs.existsSync(dir)) return 0;

    let count = 0;
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        if (entry.isDirectory()) {
            count += countFiles(path.join(dir, entry.name));
        } else {
            count++;
        }
    }
    return count;
}

console.log(`Total files: ${countFiles(ASSETS_DIR)}`);
