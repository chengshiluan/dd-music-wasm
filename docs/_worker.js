// 顶点音乐 DD Music - API Proxy Worker
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

const REF = {
    'music.163.com': 'https://music.163.com/',
    'y.qq.com': 'https://y.qq.com/',
    'kugou.com': 'https://www.kugou.com/',
    'kuwo.cn': 'https://www.kuwo.cn/',
    'bilibili.com': 'https://www.bilibili.com/',
    'migu.cn': 'https://music.migu.cn/',
};

function refFor(h) { for (const [k, v] of Object.entries(REF)) if (h.includes(k)) return v; return ''; }

async function safeJson(r) {
    const t = await r.text();
    if (!t || t[0] !== '{' && t[0] !== '[') {
        throw new Error('Non-JSON response: ' + t.slice(0, 200));
    }
    return JSON.parse(t);
}

async function proxy(url) {
    const u = new URL(url);
    const h = { 'User-Agent': UA, 'Accept': 'application/json, */*' };
    const ref = refFor(u.hostname);
    if (ref) h['Referer'] = ref;
    if (u.hostname.includes('bilibili.com')) h['Cookie'] = 'buvid3=0';
    if (u.hostname.includes('kuwo.cn')) { h['csrf'] = '1'; h['Cookie'] = 'Hm_Iuvt=1'; }
    if (u.hostname.includes('migu.cn') && u.hostname !== 'music.migu.cn') h['channel'] = '0146951';

    const r = await fetch(url, { headers: h, redirect: 'follow' });
    const body = await r.text();

    let parsed;
    try { parsed = JSON.parse(body); } catch {
        return { _proxy_error: true, status: r.status, body: body.slice(0, 500) };
    }
    return parsed;
}

// ─── QQ Music ───
async function qqSearch(kw, pg) {
    const d = await proxyPost('https://u.y.qq.com/cgi-bin/musicu.fcg', {
        comm: { ct: '19', cv: '1859', uin: '0' },
        req: { method: 'DoSearchForQQMusicDesktop', module: 'music.search.SearchCgiService', param: { grp: 1, num_per_page: 20, page_num: pg || 1, query: kw, search_type: 0 } }
    });
    const s = d.req?.data?.body?.song?.list || [];
    return { result: s.map(x => qqFormat(x)), total: d.req?.data?.meta?.sum || 0 };
}

function qqFormat(x) {
    return {
        id: 'qqtrack_' + x.mid, title: x.name, artist: x.singer[0]?.name || '',
        artist_id: 'qqartist_' + x.singer[0]?.mid, album: x.album?.name || '',
        album_id: 'qqalbum_' + x.album?.mid, source: 'qq',
        source_url: 'https://y.qq.com/#type=song&mid=' + x.mid,
        img_url: 'https://y.gtimg.cn/music/photo_new/T002R300x300M000' + x.album?.mid + '.jpg',
        duration: x.interval || 0,
    };
}

async function qqBootstrap(tid) {
    const mid = tid.replace('qqtrack_', '');
    const d = await proxyPost('https://u.y.qq.com/cgi-bin/musicu.fcg', {
        req_1: { module: 'vkey.GetVkeyServer', method: 'CgiGetVkey', param: { filename: ['M500' + mid + mid + '.mp3'], guid: '10000', songmid: [mid], songtype: [0], uin: '0', loginflag: 1, platform: '20' } },
        loginUin: '0', comm: { uin: '0', format: 'json', ct: 24, cv: 0 }
    });
    const purl = d.req_1?.data?.midurlinfo?.[0]?.purl;
    return purl ? { url: (d.req_1?.data?.sip?.[0] || '') + purl, platform: 'qq' } : { url: null };
}

async function qqChart() {
    const d = await proxyGet('https://c.y.qq.com/v8/fcg-bin/fcg_myqq_toplist.fcg?g_tk=5381&inCharset=utf-8&outCharset=utf-8&notice=0&format=json&uin=0&needNewCode=1&platform=h5', 'https://y.qq.com/');
    return (d.data?.topList || []).map(i => ({
        id: 'qqtoplist_' + i.id, title: i.topTitle, cover_img_url: i.picUrl,
        source: 'qq', source_url: 'https://y.qq.com/n/yqq/toplist/' + i.id + '.html',
    }));
}

async function qqToplistSongs(lid) {
    const tid = lid.replace('qqtoplist_', '');
    const ds = JSON.stringify({ comm: { cv: 1602, ct: 20 }, toplist: { module: 'musicToplist.ToplistInfoServer', method: 'GetDetail', param: { topid: Number(tid), num: 50, period: '' } } });
    const d = await proxyGet('https://u.y.qq.com/cgi-bin/musicu.fcg?format=json&inCharset=utf8&outCharset=utf-8&platform=yqq.json&needNewCode=0&data=' + encodeURIComponent(ds), 'https://y.qq.com/');
    return (d.toplist?.data?.songInfoList || []).map(x => qqFormat(x));
}

// ─── Kugou ───
async function kgSearch(kw, pg) {
    const d = await proxyGet('https://songsearch.kugou.com/song_search_v2?keyword=' + encodeURIComponent(kw) + '&page=' + (pg || 1) + '&pagesize=20', 'https://www.kugou.com/');
    return { result: (d.data?.lists || []).map(s => ({
        id: 'kgtrack_' + s.FileHash, title: s.SongName, artist: s.SingerName,
        album: s.AlbumName, album_id: 'kgalbum_' + s.AlbumID, source: 'kugou',
        source_url: 'https://www.kugou.com/song/#hash=' + s.FileHash,
        img_url: '', duration: s.Duration || 0,
    })), total: d.data?.total || 0 };
}

async function kgBootstrap(tid) {
    const h = tid.replace('kgtrack_', '');
    const d = await proxyGet('https://m.kugou.com/app/i/getSongInfo.php?cmd=playInfo&hash=' + h, 'https://m.kugou.com/', { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_3 like Mac OS X)' });
    return d.url ? { url: d.url, bitrate: (d.bitRate || 128) + 'kbps', platform: 'kugou' } : { url: null };
}

// ─── Bilibili ───
async function biSearch(kw, pg) {
    const d = await proxyGet('https://api.bilibili.com/x/web-interface/search/type?__refresh__=true&page=' + (pg || 1) + '&page_size=20&platform=pc&highlight=1&keyword=' + encodeURIComponent(kw) + '&search_type=video', 'https://www.bilibili.com/', { 'Cookie': 'buvid3=0' });
    const s = d.data?.result || [];
    return { result: s.map(x => biFormat(x)), total: d.data?.numResults || 0 };
}

function biFormat(x) {
    return {
        id: 'bitrack_v_' + x.bvid, title: x.title.replace(/<em class="keyword">|<\/em>/g, ''),
        artist: x.author, artist_id: 'biartist_v_' + x.mid, source: 'bilibili',
        source_url: 'https://www.bilibili.com/' + x.bvid,
        img_url: (x.pic || '').startsWith('//') ? 'https:' + x.pic : (x.pic || ''),
        duration: parseDur(x.duration),
    };
}
function parseDur(s) { const p = (s || '').split(':'); return p.length === 2 ? parseInt(p[0]) * 60 + parseInt(p[1]) : 0; }

async function biBootstrap(tid) {
    const ip = tid.replace('bitrack_v_', ''); const [bvid, cidPart] = ip.split('-'); let cid = cidPart;
    if (!cid) { const d = await proxyGet('https://api.bilibili.com/x/web-interface/view?bvid=' + bvid, 'https://www.bilibili.com/'); cid = d.data?.pages?.[0]?.cid; }
    const d = await proxyGet('https://api.bilibili.com/x/player/playurl?fnval=16&bvid=' + bvid + '&cid=' + cid, 'https://www.bilibili.com/', { 'Cookie': 'buvid3=0' });
    const au = d.data?.dash?.audio?.[0]?.baseUrl;
    return au ? { url: au, platform: 'bilibili' } : { url: null };
}

async function biPopular() {
    const d = await proxyGet('https://api.bilibili.com/x/web-interface/popular?ps=20', 'https://www.bilibili.com/');
    return (d.data?.list || []).map(v => ({
        id: 'bitrack_v_' + v.bvid, title: v.title,
        artist: v.owner?.name || '', artist_id: 'biartist_v_' + v.owner?.mid,
        source: 'bilibili', source_url: 'https://www.bilibili.com/' + v.bvid,
        img_url: (v.pic || '').startsWith('//') ? 'https:' + v.pic : (v.pic || ''),
        duration: parseDur(v.duration),
    }));
}

// ─── Migu ───
async function mgSearch(kw, pg) {
    const d = await proxyGet('https://app.u.nf.migu.cn/pc/resource/song/item/search/v1.0?text=' + encodeURIComponent(kw) + '&pageNo=' + (pg || 1) + '&pageSize=20', 'https://music.migu.cn/', { 'channel': '0146951' });
    const s = Array.isArray(d) ? d : (d.data || []);
    return { result: s.map(x => ({
        id: 'mgtrack_' + x.copyrightId, title: x.songName,
        artist: x.singerList?.[0]?.name || x.singer || '',
        artist_id: 'mgartist_' + (x.singerList?.[0]?.id || x.singerId || ''),
        album: x.albumId !== 1 ? x.album : '', album_id: x.albumId !== 1 ? 'mgalbum_' + x.albumId : '',
        source: 'migu', source_url: 'https://music.migu.cn/v3/music/song/' + x.copyrightId,
        img_url: x.img1 || '', duration: 0,
        song_id: x.songId, content_id: x.contentId, quality: x.toneControl,
    })), total: 1000 };
}

async function mgBootstrap(tid, extra) {
    const cid = tid.replace('mgtrack_', ''); let cnt = '', tf = 'PQ';
    if (extra) { try { const ex = JSON.parse(extra); cnt = ex.content_id || ''; tf = ({ '110000': 'HQ', '111100': 'SQ', '111111': 'ZQ' })[ex.quality] || 'PQ'; } catch {} }
    const d = await proxyGet('https://app.c.nf.migu.cn/MIGUM3.0/strategy/pc/listen/v1.0?scene=&netType=01&resourceType=2&copyrightId=' + cid + '&contentId=' + cnt + '&toneFlag=' + tf, 'https://music.migu.cn/', { 'channel': '0146951', 'uid': '1234' });
    let u = d.data?.url; if (!u) return { url: null };
    if (u.startsWith('//')) u = 'https:' + u;
    return { url: u.replace(/\+/g, '%2B'), platform: 'migu' };
}

// ─── Helpers ───
async function proxyGet(url, referer, extraHeaders) {
    const h = { 'User-Agent': UA, 'Accept': 'application/json, */*' };
    if (referer) h['Referer'] = referer;
    if (extraHeaders) Object.assign(h, extraHeaders);
    const r = await fetch(url, { headers: h, redirect: 'follow' });
    const t = await r.text();
    try { return JSON.parse(t); } catch {
        throw new Error('Platform returned non-JSON (HTTP ' + r.status + '): ' + t.slice(0, 300));
    }
}

async function proxyPost(url, body) {
    const u = new URL(url);
    const h = { 'User-Agent': UA, 'Content-Type': 'application/json', 'Referer': refFor(u.hostname) || 'https://y.qq.com/' };
    const r = await fetch(url, { method: 'POST', headers: h, body: JSON.stringify(body), redirect: 'follow' });
    const t = await r.text();
    try { return JSON.parse(t); } catch {
        throw new Error('Platform returned non-JSON (HTTP ' + r.status + '): ' + t.slice(0, 300));
    }
}

// ─── Router ───
async function apiRouter(url) {
    const a = url.searchParams.get('action'), p = url.searchParams.get('platform');
    const kw = url.searchParams.get('keyword'), tid = url.searchParams.get('trackId');
    const lid = url.searchParams.get('listId'), ex = url.searchParams.get('extra');
    const pg = parseInt(url.searchParams.get('page') || '1');

    try {
        switch (a) {
            case 'search':
                if (p === 'qq') return qqSearch(kw, pg);
                if (p === 'kugou') return kgSearch(kw, pg);
                if (p === 'bilibili') return biSearch(kw, pg);
                if (p === 'migu') return mgSearch(kw, pg);
                if (p === 'netease') return proxy('https://music.163.com/api/search/pc?s=' + encodeURIComponent(kw) + '&offset=' + (20 * ((pg || 1) - 1)) + '&limit=20&type=1');
                if (p === 'kuwo') return proxy('https://www.kuwo.cn/search/searchMusicBykeyWord?vipver=1&client=kt&ft=music&cluster=0&strategy=2012&encoding=utf8&rformat=json&mobi=1&issubtitle=1&show_copyright_off=1&pn=' + ((pg || 1) - 1) + '&rn=20&all=' + encodeURIComponent(kw));
                return { result: [], total: 0 };

            case 'bootstrap':
                if (p === 'qq') return qqBootstrap(tid);
                if (p === 'kugou') return kgBootstrap(tid);
                if (p === 'bilibili') return biBootstrap(tid);
                if (p === 'migu') return mgBootstrap(tid, ex);
                if (p === 'netease') return { url: 'https://music.163.com/song/media/outer/url?id=' + tid.replace('netrack_', '') + '.mp3' };
                return { url: null };

            case 'chart':
                if (p === 'qq') return lid ? { tracks: await qqToplistSongs(lid) } : qqChart();
                if (p === 'bilibili') return biPopular();
                return [];

            default:
                return { error: 'unknown action: ' + a };
        }
    } catch (e) {
        return { error: e.message };
    }
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        if (url.pathname.startsWith('/api/')) {
            const result = await apiRouter(url);
            return new Response(JSON.stringify(result), {
                headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=60' }
            });
        }
        return env.ASSETS.fetch(request);
    }
};
