const puppeteer = require('puppeteer');

// These must be provided in the GitHub Actions environment
const WORKER_URL = process.env.WORKER_URL; 
const UPDATE_SECRET = process.env.UPDATE_SECRET;

const CHANNELS = [
    "abc-usa", "accn-usa", "ae-usa", "amc-usa", "ahc-usa", "animalplanet-usa",
    "f1-on-apple", "axs-usa", "bbc-usa", "beinsportsmax-sa", "beinsportsmax2-sa",
    "bravo-usa", "cartoonnetwork-usa", "cbs-usa", "cbssn-usa", "disneychannel-usa",
    "disneyjunior-usa", "disneyxd-usa", "espn-usa", "espndeportes-usa", "espn2-usa",
    "espnews-usa", "espnu-usa", "fox-usa", "fox4k-usa", "fox-sports-1", "fox-sports-2",
    "fox-sports-1-4k", "fusballtv1uhd-de", "fusballtv2uhd-de", "golfchannel-usa",
    "mtv-usa", "nbc-usa", "nbc-sports-bayarea", "nbc-sports-philly", "nickjr-usa",
    "nickelodeon-usa", "nicktoons-usa", "sky-sports-cricket", "sky-sports-f1",
    "sky-sports-f1-uhd", "sony-ten-1", "sony-ten-3", "tbs-usa", "teenick-usa",
    "telemundo-usa", "tennischannel-usa", "tnt-usa", "tnt-sports-1", "tnt-sports-2",
    "tnt-sports-3", "tnt-sports-4", "tsn1-ca", "tsn2-ca", "tudn-usa", "tycsports-usa",
    "usanetwork-usa", "one-fc"
];

function parseExpiry(url) {
    try {
        const expiresStr = new URL(url).searchParams.get('expires');
        if (expiresStr) return parseInt(expiresStr);
    } catch (e) {}
    // Default fallback: 3 hours from now
    return Math.floor(Date.now() / 1000) + (3 * 60 * 60); 
}

async function extractStreamUrl(browser, slug) {
    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
        
        let extractedM3u8 = null;

        await page.setRequestInterception(true);
        page.on('request', request => {
            const reqUrl = request.url();
            const urlObj = new URL(reqUrl);
            
            if (urlObj.pathname.endsWith('.m3u8') && urlObj.hostname.includes('hundredmilesperhour.uk')) {
                extractedM3u8 = reqUrl;
            } else if (reqUrl.includes('ping.gif') && reqUrl.includes('mu=')) {
                const mu = urlObj.searchParams.get('mu');
                if (mu && mu.includes('.m3u8')) {
                    extractedM3u8 = decodeURIComponent(mu);
                }
            }
            request.continue();
        });

        // Dummy URL bypass logic to satisfy iframe sandboxing
        const dummyUrl = 'https://timstreams.st/';
        for(let j = 0; j < 3; j++) {
            try {
                await page.goto(dummyUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
                break;
            } catch(e) {
                await new Promise(r => setTimeout(r, 1000));
            }
        }

        await page.evaluate((channelSlug) => {
            const iframe = document.createElement('iframe');
            iframe.src = `https://vileembeds.pages.dev/embed/${channelSlug}`;
            document.body.appendChild(iframe);
        }, slug);

        // Wait up to 15 seconds for interception
        for(let wait = 0; wait < 15; wait++) {
            if(extractedM3u8) break;
            await new Promise(r => setTimeout(r, 1000));
        }

        await page.close();
        
        if (!extractedM3u8) throw new Error("Timeout extracting token");
        return { slug, url: extractedM3u8, expiresAt: parseExpiry(extractedM3u8) };
    } catch (e) {
        console.error(`[-] Failed for ${slug}: ${e.message}`);
        return null;
    }
}

async function runMegaScraper() {
    if (!WORKER_URL || !UPDATE_SECRET) {
        console.error("[-] Missing WORKER_URL or UPDATE_SECRET environment variables. Exiting.");
        process.exit(1);
    }

    console.log(`\n🚀 [MEGA-SCRAPER] Starting concurrent extraction for ${CHANNELS.length} channels...`);
    
    // GitHub Actions servers are powerful (2 CPU cores, 7GB RAM). 
    // We can safely process 10 channels at the exact same time without crashing.
    const CONCURRENCY_LIMIT = 10; 
    
    const browser = await puppeteer.launch({ 
        headless: 'new',
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
        ]
    });

    const finalResults = [];

    for (let i = 0; i < CHANNELS.length; i += CONCURRENCY_LIMIT) {
        const batch = CHANNELS.slice(i, i + CONCURRENCY_LIMIT);
        console.log(`\n[*] Pre-warming batch: ${batch.join(', ')}`);
        
        const promises = batch.map(channel => extractStreamUrl(browser, channel));
        const results = await Promise.all(promises); 
        
        for (const res of results) {
            if (res) {
                finalResults.push(res);
                console.log(`    [+] Success: ${res.slug}`);
            }
        }
    }

    await browser.close();

    console.log(`\n✅ [MEGA-SCRAPER] Extraction finished! Extracted ${finalResults.length}/${CHANNELS.length} channels.`);
    
    // --- SEND RESULTS TO CLOUDFLARE D1 DATABASE ---
    console.log(`\n[*] Sending payload to Cloudflare API: ${WORKER_URL}`);
    
    try {
        const response = await fetch(`${WORKER_URL}/api/update-streams`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${UPDATE_SECRET}`
            },
            body: JSON.stringify({ channels: finalResults })
        });
        
        const responseData = await response.json();
        
        if (response.ok) {
            console.log(`✅ [CLOUDFLARE] Database perfectly updated! ${responseData.updated} records modified.`);
        } else {
            console.error(`❌ [CLOUDFLARE] API rejected update: ${JSON.stringify(responseData)}`);
            process.exit(1);
        }
    } catch (e) {
        console.error(`❌ [NETWORK] Failed to contact Cloudflare Worker: ${e.message}`);
        process.exit(1);
    }
}

runMegaScraper();
