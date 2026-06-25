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
        
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(window, 'jwplayer', {
                get: function() {
                    return function(id) {
                        return {
                            setup: function(config) {
                                if (config.playlist && config.playlist.length > 0) {
                                    window.extractedM3U8 = config.playlist[0].file;
                                }
                            }
                        };
                    };
                }
            });
        });
        
        await page.goto(`https://vileembeds.pages.dev/embed/${slug}`, { waitUntil: 'networkidle2', timeout: 15000 });
        
        await page.waitForFunction(() => window.extractedM3U8 !== undefined, { timeout: 10000 });
        const m3u8 = await page.evaluate(() => window.extractedM3U8);
        
        await browser.close();
        return m3u8;
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
