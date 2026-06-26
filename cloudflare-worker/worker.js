export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        
        // CORS headers so test.html (and the Android App) can fetch this from anywhere
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        };

        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        // =========================================================
        // ENDPOINT 1: GET /api/get-stream?channel=fox-usa
        // Used by test.html to get the stream instantly from the DB
        // =========================================================
        if (request.method === 'GET' && url.pathname === '/api/get-stream') {
            const channel = url.searchParams.get('channel');
            if (!channel) return new Response(JSON.stringify({ error: "Missing channel" }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

            try {
                // Read from D1 database instantly
                const stmt = env.DB.prepare('SELECT stream_url, expires_at FROM channels WHERE slug = ?').bind(channel);
                const row = await stmt.first();

                if (!row) {
                    return new Response(JSON.stringify({ error: "Channel not found in database" }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
                }

                const nowUnix = Math.floor(Date.now() / 1000);
                const expiresIn = row.expires_at - nowUnix;

                return new Response(JSON.stringify({
                    streamUrl: row.stream_url,
                    expiresInSeconds: expiresIn,
                    cached: true,
                    db: true
                }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

            } catch (err) {
                return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
        }

        // =========================================================
        // ENDPOINT 2: POST /api/update-streams
        // Used by GitHub Actions to securely update the database
        // =========================================================
        if (request.method === 'POST' && url.pathname === '/api/update-streams') {
            // Check Secret Password to ensure hackers can't change your stream links
            const authHeader = request.headers.get('Authorization');
            if (authHeader !== `Bearer ${env.UPDATE_SECRET}`) {
                return new Response(JSON.stringify({ error: "Unauthorized - Invalid Secret Key" }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }

            try {
                const body = await request.json(); 
                
                if (!body.channels || !Array.isArray(body.channels)) {
                    return new Response(JSON.stringify({ error: "Invalid JSON format. Expected { channels: [...] }" }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
                }

                // Prepare a massive bulk insert/update into the SQLite Database
                const stmts = [];
                for (const ch of body.channels) {
                    stmts.push(
                        env.DB.prepare(
                            `INSERT INTO channels (slug, stream_url, expires_at) 
                             VALUES (?, ?, ?) 
                             ON CONFLICT(slug) DO UPDATE SET stream_url=excluded.stream_url, expires_at=excluded.expires_at`
                        ).bind(ch.slug, ch.url, ch.expiresAt)
                    );
                }

                // Execute all updates in a single fast batch
                await env.DB.batch(stmts);

                return new Response(JSON.stringify({ success: true, updated: body.channels.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

            } catch (err) {
                return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
        }

        // Catch-all route to confirm worker is alive
        return new Response("SoraScore API is running on Cloudflare!", { headers: corsHeaders });
    }
};
