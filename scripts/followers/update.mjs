// Refreshes data/followers.json with current Instagram follower and YouTube
// subscriber counts for the case study tiles. Runs daily via
// .github/workflows/update-followers.yml; to run it locally:
//   cd scripts/followers && npm install && npx playwright install chromium && node update.mjs
// (or skip the browser download and point CHROME_PATH at an installed Chrome).
import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

// Tile slug -> Instagram username / YouTube channel ID
const ACCOUNTS = {
    'tina-huang': { instagram: 'hellotinah', youtube: 'UC2UXDak6o7rBm23k3Vv5dww' },
    'matt-wolfe': { instagram: 'mr.eflow', youtube: 'UChpleBmo18P08aKCIgti38g' },
    'baratunde-thurston': { instagram: 'baratunde' },
    'grownyc': { instagram: 'grownyc' },
    'andrew-carnegie-foundation': { instagram: 'andrewcarnegiefdn' },
    'a-starting-point': { instagram: 'astartingpoint' },
};

const DATA_FILE = new URL('../../data/followers.json', import.meta.url);
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

// "48.5K" -> 48500, "1.31M" -> 1310000, "2,409" -> 2409
function parseCount(text) {
    const match = String(text).replace(/,/g, '').match(/([\d.]+)\s*([KMB]?)/i);
    if (!match) return null;
    const multiplier = { '': 1, K: 1e3, M: 1e6, B: 1e9 }[match[2].toUpperCase()];
    return Math.round(parseFloat(match[1]) * multiplier);
}

async function youtubeSubscribers(channelId) {
    // Exact count via the Data API when a key is configured (optional repo secret)
    const key = process.env.YOUTUBE_API_KEY;
    if (key) {
        const res = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelId}&key=${key}`);
        const count = Number((await res.json()).items?.[0]?.statistics?.subscriberCount);
        if (count) return count;
    }

    // Otherwise read the count shown in the channel page header
    const res = await fetch(`https://www.youtube.com/channel/${channelId}`, {
        headers: { 'user-agent': USER_AGENT, 'accept-language': 'en-US,en;q=0.9' },
    });
    const match = (await res.text()).match(/"metadataParts":\[\{"text":\{"content":"([\d.,]+[KMB]?) subscribers"/);
    return match ? parseCount(match[1]) : null;
}

// Instagram has no public API for this, so render the profile's public embed
// (the same widget sites use to embed a profile) and read "N followers".
async function instagramFollowers(page, username) {
    await page.goto(`https://www.instagram.com/${username}/embed/`, { waitUntil: 'domcontentloaded' });
    for (let attempt = 0; attempt < 40; attempt++) {
        const text = await page.evaluate(() => (document.body ? document.body.innerText : ''));
        const match = text.match(/([\d.,]+\s*[KMB]?)\s+followers/i);
        if (match) return parseCount(match[1]);
        await page.waitForTimeout(500);
    }
    return null;
}

const data = JSON.parse(await readFile(DATA_FILE, 'utf8'));
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
const context = await browser.newContext({ locale: 'en-US', userAgent: USER_AGENT, bypassCSP: true });
const page = await context.newPage();

let lookups = 0;
let failures = 0;
let changed = false;

for (const [slug, sources] of Object.entries(ACCOUNTS)) {
    data.accounts[slug] ??= {};
    for (const [platform, id] of Object.entries(sources)) {
        lookups++;
        const previous = data.accounts[slug][platform];
        let count = null;
        try {
            count = platform === 'instagram' ? await instagramFollowers(page, id) : await youtubeSubscribers(id);
        } catch (err) {
            console.warn(`${slug} ${platform}: ${err.message}`);
        }

        // Keep the last good value if the lookup failed or returned something implausible
        if (!count || (previous && count < previous / 2)) {
            failures++;
            console.warn(`${slug} ${platform}: got ${count}, keeping ${previous}`);
            continue;
        }
        if (count !== previous) changed = true;
        data.accounts[slug][platform] = count;
        console.log(`${slug} ${platform}: ${count}`);
    }
}

await browser.close();

if (changed) {
    data.updated = new Date().toISOString().slice(0, 10);
    await writeFile(DATA_FILE, JSON.stringify(data, null, 2) + '\n');
}

// Fail the run (so GitHub emails about it) only if nothing could be fetched
if (failures === lookups) process.exitCode = 1;
