const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

// In-memory cache
// Structure: { "fox-usa": { url: "https://...", expiresAt: 1782384665 } }
const streamCache = {};

async function extractStreamUrl(slug) {
    console.log(`[+] Launching Puppeteer to extract URL for ${slug}...`);
    const browser = await puppeteer.launch({ 
        headless: 'new',
        executablePath: '/usr/bin/google-chrome',
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
        ] // Required for Docker/Render.com
    });
    
    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
        
        let extractedM3u8 = null;

        // 1. Setup network interception
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

        // 2. Navigate to dummy wrapper (DaddyLive)
        const dummyUrl = 'https://dlhd.pk/stream/stream-44.php';
        let success = false;
        for(let j = 0; j < 3; j++) {
            try {
                await page.goto(dummyUrl, { waitUntil: 'networkidle2', timeout: 15000 });
                success = true;
                break;
            } catch(e) {
                await new Promise(r => setTimeout(r, 1000));
            }
        }

        if (success) {
            // 3. Inject the vileembeds iframe dynamically
            await page.evaluate((channelSlug) => {
                const frames = document.querySelectorAll('iframe');
                if(frames.length > 0) {
                    frames[0].src = `https://vileembeds.pages.dev/embed/${channelSlug}`;
                } else {
                    const iframe = document.createElement('iframe');
                    iframe.src = `https://vileembeds.pages.dev/embed/${channelSlug}`;
                    document.body.appendChild(iframe);
                }
            }, slug);

            // 4. Wait up to 20 seconds for the request to be intercepted
            for(let wait = 0; wait < 20; wait++) {
                if(extractedM3u8) break;
                await new Promise(r => setTimeout(r, 1000));
            }
        }

        await browser.close();
        
        if (!extractedM3u8) {
             throw new Error("Timeout: Failed to intercept m3u8 url within 20 seconds.");
        }
        
        return extractedM3u8;
    } catch (e) {
        console.error(`[-] Extraction failed: ${e.message}`);
        await browser.close();
        return null;
    }
}

function parseExpiry(url) {
    try {
        const urlObj = new URL(url);
        const expiresStr = urlObj.searchParams.get('expires');
        
        if (!expiresStr) {
             const parts = url.split('/');
             for(const part of parts) {
                 if (part.length === 10 && !isNaN(parseInt(part))) {
                     return parseInt(part); // Unix timestamp is usually 10 digits
                 }
             }
        } else {
            return parseInt(expiresStr);
        }
    } catch (e) {
        console.log("Failed to parse expiry from URL");
    }
    
    // Default fallback: 3 hours from now
    return Math.floor(Date.now() / 1000) + (3 * 60 * 60); 
}

app.get('/', (req, res) => {
    res.send('Render API is awake and alive!');
});

app.get('/api/get-stream', async (req, res) => {
    const channel = req.query.channel;
    
    if (!channel) {
        return res.status(400).json({ error: 'Missing channel parameter (e.g. ?channel=fox-usa)' });
    }
    
    const nowUnix = Math.floor(Date.now() / 1000);
    
    // 1. Check Cache
    if (streamCache[channel]) {
        // If it expires in less than 5 minutes (300 seconds), it's considered stale
        if (streamCache[channel].expiresAt > (nowUnix + 300)) {
            console.log(`[+] CACHE HIT for ${channel}. Returning instantly.`);
            return res.json({ 
                streamUrl: streamCache[channel].url, 
                cached: true,
                expiresInSeconds: streamCache[channel].expiresAt - nowUnix
            });
        } else {
            console.log(`[*] Cache for ${channel} is expiring soon. Generating new URL...`);
        }
    }
    
    // 2. Not in cache (or expired), extract it using Puppeteer
    const streamUrl = await extractStreamUrl(channel);
    
    if (streamUrl) {
        const expiresAt = parseExpiry(streamUrl);
        
        streamCache[channel] = {
            url: streamUrl,
            expiresAt: expiresAt
        };
        
        console.log(`[+] Successfully extracted and cached ${channel} until ${new Date(expiresAt * 1000).toLocaleTimeString()}`);
        
        return res.json({
            streamUrl: streamUrl,
            cached: false,
            expiresInSeconds: expiresAt - nowUnix
        });
    } else {
        return res.status(500).json({ error: 'Failed to extract stream URL.' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Render Extractor Microservice running on port ${PORT}`);
});
