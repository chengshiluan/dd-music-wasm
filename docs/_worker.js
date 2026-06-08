// 顶点音乐 DD Music - API Proxy Worker for Cloudflare Pages
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const REFERERS = {
    'music.163.com': 'https://music.163.com/',
    'y.qq.com': 'https://y.qq.com/',
    'kugou.com': 'https://www.kugou.com/',
    'kuwo.cn': 'https://www.kuwo.cn/',
    'bilibili.com': 'https://www.bilibili.com/',
    'migu.cn': 'https://music.migu.cn/',
};

function getRef(h) { for (const [k, v] of Object.entries(REFERERS)) { if (h.includes(k)) return v; } return ''; }

async function doProxy(url) {
    const u = new URL(url);
    const h = { 'User-Agent': UA, 'Accept': '*/*' };
    const r = getRef(u.hostname);
    if (r) h['Referer'] = r;
    if (u.hostname.includes('bilibili.com')) h['Cookie'] = 'buvid3=0';
    if (u.hostname.includes('kuwo.cn')) { h['csrf'] = '1'; h['Cookie'] = 'Hm_Iuvt_cdb524f42f23cer9b268564v7y735ewrq2324=1'; }
    if (u.hostname.includes('migu.cn') && u.hostname !== 'music.migu.cn') h['channel'] = '0146951';

    const resp = await fetch(url, { headers: h, redirect: 'follow' });
    const body = await resp.text();
    return new Response(body, {
        headers: { 'Content-Type': resp.headers.get('Content-Type') || 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=300' }
    });
}

// ─── QQ Music ───
async function qqSearch(kw, pg) {
    const b = JSON.stringify({ comm: { ct: '19', cv: '1859', uin: '0' }, req: { method: 'DoSearchForQQMusicDesktop', module: 'music.search.SearchCgiService', param: { grp: 1, num_per_page: 20, page_num: pg || 1, query: kw, search_type: 0 } } });
    const r = await fetch('https://u.y.qq.com/cgi-bin/musicu.fcg', { method: 'POST', headers: { 'User-Agent': UA, 'Referer': 'https://y.qq.com/', 'Content-Type': 'application/json' }, body: b });
    const d = await r.json(); const s = d.req?.data?.body?.song?.list || [];
    return { result: s.map(x => ({ id: 'qqtrack_' + x.mid, title: x.name, artist: x.singer[0]?.name || '', artist_id: 'qqartist_' + x.singer[0]?.mid, album: x.album?.name || '', album_id: 'qqalbum_' + x.album?.mid, source: 'qq', source_url: 'https://y.qq.com/#type=song&mid=' + x.mid, img_url: 'https://y.gtimg.cn/music/photo_new/T002R300x300M000' + x.album?.mid + '.jpg', duration: x.interval || 0 })), total: d.req?.data?.meta?.sum || 0 };
}

async function qqBootstrap(tid) {
    const mid = tid.replace('qqtrack_', '');
    const b = JSON.stringify({ req_1: { module: 'vkey.GetVkeyServer', method: 'CgiGetVkey', param: { filename: ['M500' + mid + mid + '.mp3'], guid: '10000', songmid: [mid], songtype: [0], uin: '0', loginflag: 1, platform: '20' } }, loginUin: '0', comm: { uin: '0', format: 'json', ct: 24, cv: 0 } });
    const r = await fetch('https://u.y.qq.com/cgi-bin/musicu.fcg', { method: 'POST', headers: { 'User-Agent': UA, 'Referer': 'https://y.qq.com/', 'Content-Type': 'application/json' }, body: b });
    const d = await r.json(); const purl = d.req_1?.data?.midurlinfo?.[0]?.purl;
    return purl ? { url: (d.req_1?.data?.sip?.[0] || '') + purl, platform: 'qq' } : { url: null };
}

async function qqChart() {
    const r = await fetch('https://c.y.qq.com/v8/fcg-bin/fcg_myqq_toplist.fcg?g_tk=5381&inCharset=utf-8&outCharset=utf-8&notice=0&format=json&uin=0&needNewCode=1&platform=h5', { headers: { 'User-Agent': UA, 'Referer': 'https://y.qq.com/' } });
    const d = await r.json();
    return (d.data?.topList || []).map(i => ({ id: 'qqtoplist_' + i.id, title: i.topTitle, cover_img_url: i.picUrl, source: 'qq', source_url: 'https://y.qq.com/n/yqq/toplist/' + i.id + '.html' }));
}

async function qqToplistSongs(lid) {
    const tid = lid.replace('qqtoplist_', '');
    const ds = JSON.stringify({ comm: { cv: 1602, ct: 20 }, toplist: { module: 'musicToplist.ToplistInfoServer', method: 'GetDetail', param: { topid: Number(tid), num: 50, period: '' } } });
    const r = await fetch('https://u.y.qq.com/cgi-bin/musicu.fcg?format=json&inCharset=utf8&outCharset=utf-8&platform=yqq.json&needNewCode=0&data=' + encodeURIComponent(ds), { headers: { 'User-Agent': UA, 'Referer': 'https://y.qq.com/' } });
    const d = await r.json(); const s = d.toplist?.data?.songInfoList || [];
    return s.map(x => ({ id: 'qqtrack_' + x.mid, title: x.name, artist: x.singer[0]?.name || '', album: x.album?.name || '', album_id: 'qqalbum_' + (x.album?.mid || ''), source: 'qq', source_url: 'https://y.qq.com/#type=song&mid=' + x.mid, img_url: 'https://y.gtimg.cn/music/photo_new/T002R300x300M000' + (x.album?.mid || '') + '.jpg', duration: x.interval || 0 }));
}

// ─── Kugou ───
async function kgSearch(kw, pg) {
    const r = await fetch('https://songsearch.kugou.com/song_search_v2?keyword=' + encodeURIComponent(kw) + '&page=' + (pg || 1) + '&pagesize=20', { headers: { 'User-Agent': UA, 'Referer': 'https://www.kugou.com/' } });
    const d = await r.json();
    return { result: (d.data?.lists || []).map(s => ({ id: 'kgtrack_' + s.FileHash, title: s.SongName, artist: s.SingerName, album: s.AlbumName, album_id: 'kgalbum_' + s.AlbumID, source: 'kugou', source_url: 'https://www.kugou.com/song/#hash=' + s.FileHash, img_url: '', duration: s.Duration || 0, lyric_url: s.FileHash })), total: d.data?.total || 0 };
}

async function kgBootstrap(tid) {
    const h = tid.replace('kgtrack_', '');
    const r = await fetch('https://m.kugou.com/app/i/getSongInfo.php?cmd=playInfo&hash=' + h, { headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_3 like Mac OS X)', 'Referer': 'https://m.kugou.com/' } });
    const d = await r.json();
    return d.url ? { url: d.url, bitrate: (d.bitRate || 128) + 'kbps', platform: 'kugou' } : { url: null };
}

// ─── Bilibili ───
async function biSearch(kw, pg) {
    const r = await fetch('https://api.bilibili.com/x/web-interface/search/type?__refresh__=true&page=' + (pg || 1) + '&page_size=20&platform=pc&highlight=1&keyword=' + encodeURIComponent(kw) + '&search_type=video', { headers: { 'User-Agent': UA, 'Referer': 'https://www.bilibili.com/', 'Cookie': 'buvid3=0' } });
    const d = await r.json(); const s = d.data?.result || [];
    return { result: s.map(x => ({ id: 'bitrack_v_' + x.bvid, title: x.title.replace(/<em class="keyword">|<\/em>/g, ''), artist: x.author, artist_id: 'biartist_v_' + x.mid, source: 'bilibili', source_url: 'https://www.bilibili.com/' + x.bvid, img_url: x.pic?.startsWith('//') ? 'https:' + x.pic : (x.pic || ''), duration: parseDur(x.duration) })), total: d.data?.numResults || 0 };
}
function parseDur(s) { const p = (s || '').split(':'); return p.length === 2 ? parseInt(p[0]) * 60 + parseInt(p[1]) : 0; }

async function biBootstrap(tid) {
    const ip = tid.replace('bitrack_v_', ''); const [bvid, cidPart] = ip.split('-'); let cid = cidPart;
    if (!cid) { const vr = await fetch('https://api.bilibili.com/x/web-interface/view?bvid=' + bvid, { headers: { 'User-Agent': UA, 'Referer': 'https://www.bilibili.com/' } }); const vd = await vr.json(); cid = vd.data?.pages?.[0]?.cid; }
    const pr = await fetch('https://api.bilibili.com/x/player/playurl?fnval=16&bvid=' + bvid + '&cid=' + cid, { headers: { 'User-Agent': UA, 'Referer': 'https://www.bilibili.com/', 'Cookie': 'buvid3=0' } }); const pd = await pr.json();
    const au = pd.data?.dash?.audio?.[0]?.baseUrl; return au ? { url: au, platform: 'bilibili' } : { url: null };
}

async function biPopular() {
    const r = await fetch('https://api.bilibili.com/x/web-interface/popular?ps=20', { headers: { 'User-Agent': UA, 'Referer': 'https://www.bilibili.com/' } });
    const d = await r.json();
    return (d.data?.list || []).map(v => ({ id: 'bitrack_v_' + v.bvid, title: v.title, artist: v.owner?.name || '', artist_id: 'biartist_v_' + v.owner?.mid, source: 'bilibili', source_url: 'https://www.bilibili.com/' + v.bvid, img_url: v.pic?.startsWith('//') ? 'https:' + v.pic : (v.pic || ''), duration: parseDur(v.duration) }));
}

// ─── Migu ───
async function mgSearch(kw, pg) {
    const r = await fetch('https://app.u.nf.migu.cn/pc/resource/song/item/search/v1.0?text=' + encodeURIComponent(kw) + '&pageNo=' + (pg || 1) + '&pageSize=20', { headers: { 'User-Agent': UA, 'channel': '0146951', 'Referer': 'https://music.migu.cn/' } });
    const d = await r.json(); const s = Array.isArray(d) ? d : (d.data || []);
    return { result: s.map(x => ({ id: 'mgtrack_' + x.copyrightId, title: x.songName, artist: x.singerList?.[0]?.name || x.singer || '', artist_id: 'mgartist_' + (x.singerList?.[0]?.id || x.singerId || ''), album: x.albumId !== 1 ? x.album : '', album_id: x.albumId !== 1 ? 'mgalbum_' + x.albumId : '', source: 'migu', source_url: 'https://music.migu.cn/v3/music/song/' + x.copyrightId, img_url: x.img1 || '', duration: 0, song_id: x.songId, content_id: x.contentId, quality: x.toneControl })), total: 1000 };
}

async function mgBootstrap(tid, extra) {
    const cid = tid.replace('mgtrack_', ''); let cnt = '', tf = 'PQ';
    if (extra) { try { const ex = JSON.parse(extra); cnt = ex.content_id || ''; tf = ({ '110000': 'HQ', '111100': 'SQ', '111111': 'ZQ' })[ex.quality] || 'PQ'; } catch {} }
    const r = await fetch('https://app.c.nf.migu.cn/MIGUM3.0/strategy/pc/listen/v1.0?scene=&netType=01&resourceType=2&copyrightId=' + cid + '&contentId=' + cnt + '&toneFlag=' + tf, { headers: { 'User-Agent': UA, 'channel': '0146951', 'uid': '1234', 'Referer': 'https://music.migu.cn/' } });
    const d = await r.json(); let u = d.data?.url; if (!u) return { url: null }; if (u.startsWith('//')) u = 'https:' + u;
    return { url: u.replace(/\+/g, '%2B'), platform: 'migu' };
}

// ─── Route ───
async function apiRouter(url) {
    const a = url.searchParams.get('action'), p = url.searchParams.get('platform'), kw = url.searchParams.get('keyword'), tid = url.searchParams.get('trackId'), lid = url.searchParams.get('listId'), ex = url.searchParams.get('extra'), pg = parseInt(url.searchParams.get('page') || '1'), proxy = url.searchParams.get('proxy');
    if (proxy) return doProxy(proxy);
    try {
        switch (a) {
            case 'search': if (p === 'qq') return qqSearch(kw, pg); if (p === 'kugou') return kgSearch(kw, pg); if (p === 'bilibili') return biSearch(kw, pg); if (p === 'migu') return mgSearch(kw, pg); if (p === 'netease') return { proxy: 'https://music.163.com/api/search/pc?s=' + encodeURIComponent(kw) + '&offset=' + (20 * ((pg || 1) - 1)) + '&limit=20&type=1' }; if (p === 'kuwo') return { proxy: 'https://www.kuwo.cn/search/searchMusicBykeyWord?vipver=1&client=kt&ft=music&cluster=0&strategy=2012&encoding=utf8&rformat=json&mobi=1&issubtitle=1&show_copyright_off=1&pn=' + ((pg || 1) - 1) + '&rn=20&all=' + encodeURIComponent(kw) }; return { result: [], total: 0 };
            case 'bootstrap': if (p === 'qq') return qqBootstrap(tid); if (p === 'kugou') return kgBootstrap(tid); if (p === 'bilibili') return biBootstrap(tid); if (p === 'migu') return mgBootstrap(tid, ex); if (p === 'netease') return { url: 'https://music.163.com/song/media/outer/url?id=' + tid.replace('netrack_', '') + '.mp3' }; return { url: null };
            case 'chart': if (p === 'qq') return lid ? { tracks: await qqToplistSongs(lid) } : qqChart(); if (p === 'bilibili') return biPopular(); return [];
            case 'proxyFetch': return doProxy(proxy || kw);
            default: return { error: 'unknown action' };
        }
    } catch (e) { return { error: e.message }; }
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        if (url.pathname.startsWith('/api/')) {
            const result = await apiRouter(url);
            if (result && result.proxy) return doProxy(result.proxy);
            return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=300' } });
        }
        return env.ASSETS.fetch(request);
    }
};
