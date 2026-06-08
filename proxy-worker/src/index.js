// Reverse proxy worker - serves dd-music Pages content on custom domain

const PAGES_HOST = 'dd-music.pages.dev';

export default {
    async fetch(request) {
        const url = new URL(request.url);
        const targetUrl = new URL(url.pathname + url.search, `https://${PAGES_HOST}`);

        const modifiedRequest = new Request(targetUrl, {
            method: request.method,
            headers: request.headers,
            body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
            redirect: 'follow',
        });

        const response = await fetch(modifiedRequest);

        // Rewrite any absolute URLs to the custom domain
        let body = await response.text();
        const contentType = response.headers.get('content-type') || '';

        if (contentType.includes('text/html') || contentType.includes('application/javascript') || contentType.includes('text/css')) {
            body = body.replaceAll(`https://${PAGES_HOST}`, `https://ddmusic.eu.cc`);
            body = body.replaceAll(`http://${PAGES_HOST}`, `https://ddmusic.eu.cc`);
        }

        return new Response(body, {
            status: response.status,
            headers: response.headers,
        });
    },
};
