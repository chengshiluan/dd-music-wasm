// 顶点音乐 DD Music - API Proxy Worker v2
// Based on Listen1 source code - correct API implementations
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const REF = {
  'music.163.com': 'https://music.163.com/',
  'y.qq.com': 'https://y.qq.com/',
  'kugou.com': 'https://www.kugou.com/',
  'kuwo.cn': 'https://www.kuwo.cn/',
  'bilibili.com': 'https://www.bilibili.com/',
  'migu.cn': 'https://music.migu.cn/',
};

function refFor(h) { for (const [k, v] of Object.entries(REF)) if (h.includes(k)) return v; return ''; }

// ─── Generic proxy helpers ───
async function proxyGet(url, referer, extraHeaders) {
  const h = { 'User-Agent': UA, 'Accept': 'application/json, */*' };
  if (referer) h['Referer'] = referer;
  if (extraHeaders) Object.assign(h, extraHeaders);
  const r = await fetch(url, { headers: h, redirect: 'follow' });
  const t = await r.text();
  try { return JSON.parse(t); } catch {
    return { _proxy_error: true, status: r.status, body: t.slice(0, 500) };
  }
}

async function proxyPost(url, body, referer, extraHeaders) {
  const u = new URL(url);
  const h = { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': '*/*' };
  if (referer || refFor(u.hostname)) h['Referer'] = referer || refFor(u.hostname);
  if (extraHeaders) Object.assign(h, extraHeaders);
  const r = await fetch(url, { method: 'POST', headers: h, body, redirect: 'follow' });
  const t = await r.text();
  try { return JSON.parse(t); } catch {
    return { _proxy_error: true, status: r.status, body: t.slice(0, 500) };
  }
}

async function proxyPostJson(url, data, referer) {
  const u = new URL(url);
  const h = { 'User-Agent': UA, 'Content-Type': 'application/json', 'Referer': referer || refFor(u.hostname) || 'https://y.qq.com/' };
  const r = await fetch(url, { method: 'POST', headers: h, body: JSON.stringify(data), redirect: 'follow' });
  const t = await r.text();
  try { return JSON.parse(t); } catch {
    return { _proxy_error: true, status: r.status, body: t.slice(0, 500) };
  }
}

// ─── HTML decode ───
function htmlDecode(str) {
  if (!str) return '';
  const entities = [['amp','&'],['apos',"'"],['lt','<'],['gt','>'],['nbsp',' '],['quot','"'],['#39',"'"]];
  let text = str;
  for (const [entity, char] of entities) text = text.replace(new RegExp(`&${entity};`, 'g'), char);
  return text;
}

// ─── Netease (网易云) ───
// Listen1 uses weapi with AES/RSA encryption for some endpoints.
// For Cloudflare Worker, we use the simpler /api/ endpoints with proper headers.
// These work without encryption when Referer is set correctly.

async function neSearch(kw, pg) {
  const offset = 20 * ((pg || 1) - 1);
  const data = `s=${encodeURIComponent(kw)}&offset=${offset}&limit=20&type=1`;
  const d = await proxyPost('https://music.163.com/api/search/pc', data, 'https://music.163.com/');
  if (d._proxy_error) return d;
  const songs = d.result?.songs || [];
  return {
    result: songs.map(s => ({
      id: 'netrack_' + s.id, title: s.name,
      artist: s.artists?.[0]?.name || '', artist_id: 'neartist_' + (s.artists?.[0]?.id || ''),
      album: s.album?.name || '', album_id: 'nealbum_' + (s.album?.id || ''),
      source: 'netease', source_url: 'https://music.163.com/#/song?id=' + s.id,
      img_url: s.album?.picUrl || '', duration: Math.floor((s.duration || 0) / 1000),
      disable: s.fee === 4 || s.fee === 1,
    })),
    total: d.result?.songCount || 0,
  };
}

async function neBootstrap(tid) {
  const songId = tid.replace('netrack_', '');
  // Method 1: outer url (works for most free songs)
  const outerUrl = `https://music.163.com/song/media/outer/url?id=${songId}.mp3`;
  // Try to verify the URL works by checking the redirect
  try {
    const r = await fetch(outerUrl, {
      headers: { 'User-Agent': UA, 'Referer': 'https://music.163.com/' },
      redirect: 'manual',
    });
    const loc = r.headers.get('location');
    if (loc && !loc.includes('404') && !loc.includes('music.163.com/404')) {
      return { url: loc || outerUrl, platform: 'netease' };
    }
  } catch {}
  // Fallback: return the outer URL and let the browser handle it
  return { url: outerUrl, platform: 'netease' };
}

async function neChart() {
  const d = await proxyGet('https://music.163.com/api/toplist', 'https://music.163.com/');
  if (d._proxy_error || !d.list) return [];
  return d.list.slice(0, 10).map(item => ({
    id: 'neplaylist_' + item.id, title: item.name,
    cover_img_url: item.coverImgUrl, source: 'netease',
    source_url: 'https://music.163.com/#/playlist?id=' + item.id,
  }));
}

async function nePlaylistTracks(listId) {
  const pid = listId.replace('neplaylist_', '');
  const d = await proxyGet('https://music.163.com/api/playlist/detail?id=' + pid, 'https://music.163.com/');
  if (d._proxy_error || !d.playlist) return { tracks: [], info: {} };
  const info = {
    id: 'neplaylist_' + pid, title: d.playlist.name,
    cover_img_url: d.playlist.coverImgUrl,
    source_url: 'https://music.163.com/#/playlist?id=' + pid,
  };
  const tracks = (d.playlist.tracks || []).map(t => ({
    id: 'netrack_' + t.id, title: t.name,
    artist: t.ar?.[0]?.name || '', artist_id: 'neartist_' + (t.ar?.[0]?.id || ''),
    album: t.al?.name || '', album_id: 'nealbum_' + (t.al?.id || ''),
    source: 'netease', source_url: 'https://music.163.com/#/song?id=' + t.id,
    img_url: t.al?.picUrl || '', duration: Math.floor((t.dt || 0) / 1000),
    disable: t.fee === 4 || t.fee === 1,
  }));
  return { tracks, info };
}

// ─── QQ Music ───
async function qqSearch(kw, pg) {
  const d = await proxyPostJson('https://u.y.qq.com/cgi-bin/musicu.fcg', {
    comm: { ct: '19', cv: '1859', uin: '0' },
    req: { method: 'DoSearchForQQMusicDesktop', module: 'music.search.SearchCgiService',
      param: { grp: 1, num_per_page: 20, page_num: pg || 1, query: kw, search_type: 0 } }
  });
  if (d._proxy_error) return d;
  const s = d.req?.data?.body?.song?.list || [];
  return { result: s.map(x => qqFormat(x)), total: d.req?.data?.meta?.sum || 0 };
}

function qqFormat(x) {
  return {
    id: 'qqtrack_' + x.mid || x.songmid, title: htmlDecode(x.name || x.songname),
    artist: htmlDecode(x.singer?.[0]?.name || ''), artist_id: 'qqartist_' + (x.singer?.[0]?.mid || ''),
    album: htmlDecode(x.album?.name || x.albumname || ''), album_id: 'qqalbum_' + (x.album?.mid || x.albummid || ''),
    source: 'qq', source_url: 'https://y.qq.com/#type=song&mid=' + (x.mid || x.songmid),
    img_url: (x.album?.mid || x.albummid) ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${x.album?.mid || x.albummid}.jpg` : '',
    duration: x.interval || 0,
  };
}

async function qqBootstrap(tid) {
  const mid = tid.replace('qqtrack_', '');
  const d = await proxyPostJson('https://u.y.qq.com/cgi-bin/musicu.fcg', {
    req_1: { module: 'vkey.GetVkeyServer', method: 'CgiGetVkey',
      param: { filename: ['M500' + mid + mid + '.mp3'], guid: '10000', songmid: [mid], songtype: [0], uin: '0', loginflag: 1, platform: '20' } },
    loginUin: '0', comm: { uin: '0', format: 'json', ct: 24, cv: 0 }
  });
  if (d._proxy_error) return { url: null };
  const purl = d.req_1?.data?.midurlinfo?.[0]?.purl;
  return purl ? { url: (d.req_1?.data?.sip?.[0] || '') + purl, platform: 'qq' } : { url: null };
}

async function qqChart() {
  const d = await proxyGet('https://c.y.qq.com/v8/fcg-bin/fcg_myqq_toplist.fcg?g_tk=5381&inCharset=utf-8&outCharset=utf-8&notice=0&format=json&uin=0&needNewCode=1&platform=h5', 'https://y.qq.com/');
  if (d._proxy_error || !d.data) return [];
  return (d.data?.topList || []).map(i => ({
    id: 'qqtoplist_' + i.id, title: i.topTitle, cover_img_url: i.picUrl,
    source: 'qq', source_url: 'https://y.qq.com/n/yqq/toplist/' + i.id + '.html',
  }));
}

async function qqToplistSongs(lid) {
  const tid = lid.replace('qqtoplist_', '');
  const ds = JSON.stringify({ comm: { cv: 1602, ct: 20 }, toplist: { module: 'musicToplist.ToplistInfoServer', method: 'GetDetail', param: { topid: Number(tid), num: 50, period: '' } } });
  const d = await proxyGet('https://u.y.qq.com/cgi-bin/musicu.fcg?format=json&inCharset=utf8&outCharset=utf-8&platform=yqq.json&needNewCode=0&data=' + encodeURIComponent(ds), 'https://y.qq.com/');
  if (d._proxy_error) return { tracks: [], info: {} };
  const info = {
    id: 'qqtoplist_' + tid, title: d.toplist?.data?.data?.title || '',
    cover_img_url: d.toplist?.data?.data?.frontPicUrl || '',
    source_url: 'https://y.qq.com/n/yqq/toplist/' + tid + '.html',
  };
  const tracks = (d.toplist?.data?.songInfoList || []).map(x => qqFormat(x));
  return { tracks, info };
}

// ─── Kugou (酷狗) ───
async function kgSearch(kw, pg) {
  const d = await proxyGet('https://songsearch.kugou.com/song_search_v2?keyword=' + encodeURIComponent(kw) + '&page=' + (pg || 1) + '&pagesize=20', 'https://www.kugou.com/');
  if (d._proxy_error) return d;
  const lists = d.data?.lists || [];
  // Get cover images by fetching song info for each track
  const results = [];
  for (const s of lists) {
    const track = {
      id: 'kgtrack_' + s.FileHash, title: s.SongName, artist: s.SingerName,
      album: s.AlbumName, album_id: 'kgalbum_' + s.AlbumID, source: 'kugou',
      source_url: 'https://www.kugou.com/song/#hash=' + s.FileHash,
      img_url: '', duration: s.Duration || 0,
    };
    // Fetch cover image from song info
    try {
      const info = await proxyGet('https://m.kugou.com/app/i/getSongInfo.php?cmd=playInfo&hash=' + s.FileHash, 'https://m.kugou.com/', { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_3 like Mac OS X)' });
      if (info && !info._proxy_error) {
        if (info.img) track.img_url = info.img.replace('{size}', '400');
        else if (info.album_img) track.img_url = info.album_img.replace('{size}', '400');
        else if (info.songName) track.title = info.songName;
        if (info.singerName) track.artist = info.singerName;
      }
    } catch {}
    results.push(track);
  }
  return { result: results, total: d.data?.total || 0 };
}

async function kgBootstrap(tid) {
  const h = tid.replace('kgtrack_', '');
  const d = await proxyGet('https://m.kugou.com/app/i/getSongInfo.php?cmd=playInfo&hash=' + h, 'https://m.kugou.com/', { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_3 like Mac OS X)' });
  if (d._proxy_error) return { url: null };
  return d.url ? { url: d.url, bitrate: (d.bitRate || 128) + 'kbps', platform: 'kugou' } : { url: null };
}

// ─── Kuwo (酷我) ───
// Kuwo requires a Secret header computed from a token cookie.
// Ported from Listen1 kuwo.js

function kuwoEncrypt(token, key) {
  if (!key || key.length <= 0) return null;
  let n = '';
  for (let i = 0; i < key.length; i++) n += key.charCodeAt(i).toString();
  const r = Math.floor(n.length / 5);
  const o = parseInt(n.charAt(r) + n.charAt(2 * r) + n.charAt(3 * r) + n.charAt(4 * r) + n.charAt(5 * r));
  const l = Math.ceil(key.length / 2);
  const c = Math.pow(2, 31) - 1;
  if (o < 2) return null;
  let d = Math.round(1e9 * Math.random()) % 1e8;
  n += d.toString();
  while (n.length > 10) n = (parseInt(n.substring(0, 10)) + parseInt(n.substring(10, n.length))).toString();
  n = (o * parseInt(n) + l) % c;
  let f = '';
  let h2;
  for (let i = 0; i < token.length; i++) {
    h2 = parseInt(token.charCodeAt(i) ^ Math.floor((n / c) * 255));
    f += (h2 < 16 ? '0' : '') + h2.toString(16);
    n = (o * n + l) % c;
  }
  d = d.toString(16);
  while (d.length < 8) d = '0' + d;
  return f + d;
}

async function kuwoGetToken() {
  const cookieName = 'Hm_Iuvt_cdb524f42f23cer9b268564v7y735ewrq2324';
  // Try to get token from kuwo.cn
  const r = await fetch('https://www.kuwo.cn/', {
    headers: { 'User-Agent': UA, 'Accept': 'text/html' },
    redirect: 'follow',
  });
  const setCookie = r.headers.getAll?.('set-cookie') || r.headers.get('set-cookie') || '';
  // Extract token from set-cookie
  const match = setCookie.match(new RegExp(cookieName + '=([^;]+)'));
  if (match) return match[1];
  // If no token from set-cookie, try the search directly with csrf
  return '';
}

async function kuwoRequest(url) {
  const token = await kuwoGetToken();
  const cookieName = 'Hm_Iuvt_cdb524f42f23cer9b268564v7y735ewrq2324';
  const headers = {
    'User-Agent': UA, 'Accept': 'application/json',
    'Referer': 'https://www.kuwo.cn/',
    'Cookie': 'Hm_Iuvt=1',
  };
  if (token) {
    const secret = kuwoEncrypt(token, cookieName);
    if (secret) headers['Secret'] = secret;
    headers['Cookie'] += '; ' + cookieName + '=' + token;
  } else {
    headers['csrf'] = '1';
  }
  const r = await fetch(url, { headers, redirect: 'follow' });
  const t = await r.text();
  try { return JSON.parse(t); } catch {
    return { _proxy_error: true, status: r.status, body: t.slice(0, 500) };
  }
}

async function kwSearch(kw, pg) {
  const pn = (pg || 1) - 1;
  const url = `https://www.kuwo.cn/search/searchMusicBykeyWord?vipver=1&client=kt&ft=music&cluster=0&strategy=2012&encoding=utf8&rformat=json&mobi=1&issubtitle=1&show_copyright_off=1&pn=${pn}&rn=20&all=${encodeURIComponent(kw)}`;
  const d = await kuwoRequest(url);
  if (d._proxy_error) {
    // Fallback to abslist format
    const list = d.abslist || [];
    return { result: list.map(s => ({
      id: 'kwtrack_' + s.DC_TARGETID, title: htmlDecode(s.NAME),
      artist: htmlDecode(s.ARTIST), artist_id: 'kwartist_' + s.ARTISTID,
      album: htmlDecode(s.ALBUM), album_id: 'kwalbum_' + s.ALBUMID,
      source: 'kuwo', source_url: 'https://www.kuwo.cn/play_detail/' + s.DC_TARGETID,
      img_url: s.web_albumpic_short ? `https://img2.kuwo.cn/star/albumcover/${s.web_albumpic_short}` : '',
      duration: parseInt(s.DURATION || 0), lyric_url: s.DC_TARGETID,
    })), total: parseInt(d.HIT || 0) };
  }
  // Handle new format
  const list = d.abslist || [];
  return { result: list.map(s => ({
    id: 'kwtrack_' + s.DC_TARGETID, title: htmlDecode(s.NAME),
    artist: htmlDecode(s.ARTIST), artist_id: 'kwartist_' + s.ARTISTID,
    album: htmlDecode(s.ALBUM), album_id: 'kwalbum_' + s.ALBUMID,
    source: 'kuwo', source_url: 'https://www.kuwo.cn/play_detail/' + s.DC_TARGETID,
    img_url: s.web_albumpic_short ? `https://img2.kuwo.cn/star/albumcover/${s.web_albumpic_short}` : '',
    duration: parseInt(s.DURATION || 0), lyric_url: s.DC_TARGETID,
  })), total: parseInt(d.HIT || 0) };
}

async function kwBootstrap(tid) {
  const songId = tid.replace('kwtrack_', '');
  const url = `https://www.kuwo.cn/api/v1/www/music/playUrl?mid=${songId}&type=music&httpsStatus=1&reqId=&plat=web_www&from=`;
  const d = await kuwoRequest(url);
  if (d._proxy_error) return { url: null };
  if (d.data && d.data.url) {
    return { url: d.data.url, platform: 'kuwo' };
  }
  return { url: null };
}

// ─── Bilibili ───
async function biSearch(kw, pg) {
  const url = 'https://api.bilibili.com/x/web-interface/search/type?__refresh__=true&page=' + (pg || 1) + '&page_size=20&platform=pc&highlight=1&keyword=' + encodeURIComponent(kw) + '&search_type=video';
  const d = await proxyGet(url, 'https://www.bilibili.com/', { 'Cookie': 'buvid3=0' });
  if (d._proxy_error) return d;
  const s = d.data?.result || [];
  return { result: s.map(x => biFormat(x)), total: d.data?.numResults || 0 };
}

function biFormat(x) {
  let imgUrl = x.pic || '';
  if (imgUrl.startsWith('//')) imgUrl = 'https:' + imgUrl;
  return {
    id: 'bitrack_v_' + x.bvid,
    title: (x.title || '').replace(/<em class="keyword">|<\/em>/g, ''),
    artist: x.author || '', artist_id: 'biartist_v_' + (x.mid || ''),
    source: 'bilibili', source_url: 'https://www.bilibili.com/' + x.bvid,
    img_url: imgUrl, duration: parseDur(x.duration),
  };
}

function parseDur(s) { const p = (s || '').split(':'); return p.length === 2 ? parseInt(p[0]) * 60 + parseInt(p[1]) : (p.length === 3 ? parseInt(p[0]) * 3600 + parseInt(p[1]) * 60 + parseInt(p[2]) : 0); }

async function biBootstrap(tid) {
  const ip = tid.replace('bitrack_v_', '');
  const [bvid, cidPart] = ip.split('-');
  let cid = cidPart;
  if (!cid) {
    const info = await proxyGet('https://api.bilibili.com/x/web-interface/view?bvid=' + bvid, 'https://www.bilibili.com/');
    if (info._proxy_error) return { url: null };
    cid = info.data?.pages?.[0]?.cid;
  }
  if (!cid) return { url: null };
  // Use fnval=16 for DASH audio (higher quality)
  const d = await proxyGet('https://api.bilibili.com/x/player/playurl?fnval=16&bvid=' + bvid + '&cid=' + cid, 'https://www.bilibili.com/', { 'Cookie': 'buvid3=0' });
  if (d._proxy_error) return { url: null };
  const au = d.data?.dash?.audio?.[0]?.baseUrl;
  if (au) return { url: au, platform: 'bilibili' };
  // Fallback: try fnval=0 for MP3
  const d2 = await proxyGet('https://api.bilibili.com/x/player/playurl?fnval=0&bvid=' + bvid + '&cid=' + cid, 'https://www.bilibili.com/', { 'Cookie': 'buvid3=0' });
  if (d2._proxy_error) return { url: null };
  const durl = d2.data?.durl?.[0]?.url;
  return durl ? { url: durl, platform: 'bilibili' } : { url: null };
}

async function biPopular() {
  const d = await proxyGet('https://api.bilibili.com/x/web-interface/popular?ps=20', 'https://www.bilibili.com/');
  if (d._proxy_error) return [];
  return (d.data?.list || []).map(v => ({
    id: 'bitrack_v_' + v.bvid, title: v.title,
    artist: v.owner?.name || '', artist_id: 'biartist_v_' + (v.owner?.mid || ''),
    source: 'bilibili', source_url: 'https://www.bilibili.com/' + v.bvid,
    img_url: (v.pic || '').startsWith('//') ? 'https:' + v.pic : (v.pic || ''),
    duration: parseDur(String(v.duration || '')),
  }));
}

// ─── Migu (咪咕) ───
async function mgSearch(kw, pg) {
  const url = 'https://app.u.nf.migu.cn/pc/resource/song/item/search/v1.0?text=' + encodeURIComponent(kw) + '&pageNo=' + (pg || 1) + '&pageSize=20';
  const d = await proxyGet(url, 'https://music.migu.cn/', { 'channel': '0146951' });
  if (d._proxy_error) return d;
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
  const cid = tid.replace('mgtrack_', '');
  let cnt = '', tf = 'PQ';
  if (extra) { try { const ex = JSON.parse(extra); cnt = ex.content_id || ''; tf = ({ '110000': 'HQ', '111100': 'SQ', '111111': 'ZQ' })[ex.quality] || 'PQ'; } catch {} }
  const d = await proxyGet('https://app.c.nf.migu.cn/MIGUM3.0/strategy/pc/listen/v1.0?scene=&netType=01&resourceType=2&copyrightId=' + cid + '&contentId=' + cnt + '&toneFlag=' + tf, 'https://music.migu.cn/', { 'channel': '0146951', 'uid': '1234' });
  if (d._proxy_error) return { url: null };
  let u = d.data?.url;
  if (!u) return { url: null };
  if (u.startsWith('//')) u = 'https:' + u;
  return { url: u.replace(/\+/g, '%2B'), platform: 'migu' };
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
        if (p === 'netease') return neSearch(kw, pg);
        if (p === 'qq') return qqSearch(kw, pg);
        if (p === 'kugou') return kgSearch(kw, pg);
        if (p === 'kuwo') return kwSearch(kw, pg);
        if (p === 'bilibili') return biSearch(kw, pg);
        if (p === 'migu') return mgSearch(kw, pg);
        return { result: [], total: 0 };

      case 'bootstrap':
        if (p === 'netease') return neBootstrap(tid);
        if (p === 'qq') return qqBootstrap(tid);
        if (p === 'kugou') return kgBootstrap(tid);
        if (p === 'kuwo') return kwBootstrap(tid);
        if (p === 'bilibili') return biBootstrap(tid);
        if (p === 'migu') return mgBootstrap(tid, ex);
        return { url: null };

      case 'chart':
        if (p === 'netease') return lid ? nePlaylistTracks(lid) : neChart();
        if (p === 'qq') return lid ? qqToplistSongs(lid) : qqChart();
        if (p === 'bilibili') return biPopular();
        if (p === 'kugou') return []; // kugou chart not available via simple API
        if (p === 'kuwo') return []; // kuwo chart not available via simple API
        if (p === 'migu') return []; // migu chart not available via simple API
        return [];

      case 'playlist':
        if (p === 'netease') return nePlaylistTracks(lid);
        return { tracks: [], info: {} };

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
