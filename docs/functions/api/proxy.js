// Cloudflare Pages Function - API proxy for music platform requests
export async function onRequestGet(context) {
    const { request } = context;
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');

    if (!targetUrl) {
        return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    }

    // Basic URL validation - only allow known music API hosts
    const allowedHosts = [
        'music.163.com',
        'c.y.qq.com',
        'u.y.qq.com',
        'songsearch.kugou.com',
        'www.kuwo.cn',
        'api.bilibili.com',
        'm.music.migu.cn',
    ];

    try {
        const targetUrlObj = new URL(targetUrl);
        if (!allowedHosts.some(h => targetUrlObj.hostname.endsWith(h))) {
            return new Response(JSON.stringify({ error: 'Host not allowed' }), {
                status: 403,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });
        }
    } catch {
        return new Response(JSON.stringify({ error: 'Invalid url' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    }

    // Build proxy request headers
    const proxyHeaders = new Headers();
    proxyHeaders.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

    // Forward relevant headers
    const referer = request.headers.get('Referer') || request.headers.get('referer');
    if (referer) {
        proxyHeaders.set('Referer', referer);
    }

    // Set CSRF header for Kuwo
    if (targetUrl.includes('kuwo.cn')) {
        proxyHeaders.set('csrf', '1');
        proxyHeaders.set('Referer', 'https://www.kuwo.cn/');
    }

    // Set Referer for other platforms that need it
    if (targetUrl.includes('bilibili.com')) {
        proxyHeaders.set('Referer', 'https://www.bilibili.com/');
    }
    if (targetUrl.includes('migu.cn')) {
        proxyHeaders.set('Referer', 'https://m.music.migu.cn/');
    }

    try {
        const response = await fetch(targetUrl, {
            headers: proxyHeaders,
            redirect: 'follow',
        });

        const body = await response.text();

        return new Response(body, {
            status: response.status,
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=300',
            }
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: 'Proxy request failed', detail: err.message }), {
            status: 502,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    }
}
