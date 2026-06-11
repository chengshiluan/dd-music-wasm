// 顶点音乐 DD Music - API Proxy Worker v3.1 (D1)
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

function htmlDecode(str) {
  if (!str) return '';
  const entities = [['amp','&'],['apos',"'"],['lt','<'],['gt','>'],['nbsp',' '],['quot','"'],['#39',"'"]];
  let text = str;
  for (const [entity, char] of entities) text = text.replace(new RegExp(`&${entity};`, 'g'), char);
  return text;
}

// ─── Netease ───
async function neSearch(kw, pg) {
  const offset = 20 * ((pg || 1) - 1);
  const d = await proxyGet('https://music.163.com/api/cloudsearch/pc?s=' + encodeURIComponent(kw) + '&offset=' + offset + '&limit=20&type=1', 'https://music.163.com/');
  if (d._proxy_error) return d;
  const songs = d.result?.songs || [];
  return {
    result: songs.map(s => ({
      id: 'netrack_' + s.id, title: s.name,
      artist: s.ar?.[0]?.name || s.artists?.[0]?.name || '',
      artist_id: 'neartist_' + (s.ar?.[0]?.id || s.artists?.[0]?.id || ''),
      album: s.al?.name || s.album?.name || '',
      album_id: 'nealbum_' + (s.al?.id || s.album?.id || ''),
      source: 'netease', source_url: 'https://music.163.com/#/song?id=' + s.id,
      img_url: s.al?.picUrl || s.album?.picUrl || '',
      duration: Math.floor((s.dt || s.duration || 0) / 1000),
      disable: s.fee === 4 || s.fee === 1,
    })),
    total: d.result?.songCount || 0,
  };
}

async function neBootstrap(tid) {
  const songId = tid.replace('netrack_', '');
  const outerUrl = `https://music.163.com/song/media/outer/url?id=${songId}.mp3`;
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
  const d = await proxyGet('https://music.163.com/api/v6/playlist/detail?id=' + pid + '&n=1000&s=0', 'https://music.163.com/');
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

const NE_CATEGORIES = ["华语", "流行", "摇滚", "民谣", "电子", "说唱", "R&B", "古风", "轻音乐", "ACG"];

async function neDiscover() {
  const results = await Promise.all(NE_CATEGORIES.map(async (cat) => {
    const d = await proxyGet(
      "https://music.163.com/api/playlist/list?cat=" + encodeURIComponent(cat) + "&offset=0&limit=12",
      "https://music.163.com/"
    );
    if (d._proxy_error || !d.playlists) return { category: cat, playlists: [] };
    return {
      category: cat,
      playlists: d.playlists.map(item => ({
        id: "neplaylist_" + item.id, title: item.name,
        cover_img_url: item.coverImgUrl, source: "netease",
        playCount: item.playCount || 0,
        source_url: "https://music.163.com/#/playlist?id=" + item.id,
      }))
    };
  }));
  return results.filter(r => r.playlists.length > 0);
}

async function neLyric(trackId) {
  const songId = trackId.replace('netrack_', '');
  const d = await proxyGet('https://music.163.com/api/song/lyric?id=' + songId + '&lv=1', 'https://music.163.com/');
  if (d._proxy_error) return { lyric: '', tlyric: '' };
  return { lyric: d.lrc?.lyric || '', tlyric: d.tlyric?.lyric || '' };
}

async function neUserPlaylists(uid, cookie) {
  if (!uid || !cookie) return { playlists: [], error: 'missing uid or cookie' };
  const h = { 'User-Agent': UA, 'Accept': 'application/json', 'Referer': 'https://music.163.com/', 'Cookie': cookie };
  const r = await fetch('https://music.163.com/api/user/playlist/?uid=' + uid + '&limit=30&offset=0', { headers: h, redirect: 'follow' });
  const t = await r.text();
  let d;
  try { d = JSON.parse(t); } catch { return { playlists: [], error: 'parse failed' }; }
  if (d.code !== 200 || !d.playlist) return { playlists: [], error: 'api returned code ' + d.code };
  return {
    playlists: d.playlist.map(item => ({
      id: 'neplaylist_' + item.id, title: item.name,
      cover_img_url: item.coverImgUrl, source: 'netease',
      playCount: item.playCount || 0, trackCount: item.trackCount || 0,
      creator: item.creator?.nickname || '',
      source_url: 'https://music.163.com/#/playlist?id=' + item.id,
    }))
  };
}

async function neLoginCheck(cookie) {
  if (!cookie) return { ok: false, error: 'no cookie' };
  const h = { 'User-Agent': UA, 'Accept': 'application/json', 'Referer': 'https://music.163.com/', 'Cookie': cookie };
  const r = await fetch('https://music.163.com/api/nuser/account/get', { headers: h, redirect: 'follow' });
  const t = await r.text();
  let d;
  try { d = JSON.parse(t); } catch { return { ok: false, error: 'parse failed' }; }
  if (d.code === 200 && d.profile) {
    return { ok: true, uid: d.profile.userId, nickname: d.profile.nickname, avatar: d.profile.avatarUrl };
  }
  return { ok: false, error: 'cookie invalid' };
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

// ─── Kugou ───
async function kgSearch(kw, pg) {
  const d = await proxyGet('http://mobilecdnbj.kugou.com/api/v3/search/song?keyword=' + encodeURIComponent(kw) + '&page=' + (pg || 1) + '&pagesize=20', 'https://www.kugou.com/');
  if (d._proxy_error) return d;
  const lists = d.data?.info || [];
  return {
    result: lists.map(s => ({
      id: 'kgtrack_' + s.hash, title: s.songname || s.filename?.split('-')?.pop()?.trim() || '',
      artist: s.singername || s.filename?.split('-')?.[0]?.trim() || '',
      album: s.album_name || '', album_id: 'kgalbum_' + (s.album_id || ''),
      source: 'kugou', source_url: 'https://www.kugou.com/song/#hash=' + s.hash,
      img_url: s.album_img ? s.album_img.replace('{size}', '400') : '',
      duration: s.duration || 0,
    })),
    total: d.data?.total || 0,
  };
}

async function kgBootstrap(tid) {
  const h = tid.replace('kgtrack_', '');
  const d = await proxyGet('https://m.kugou.com/app/i/getSongInfo.php?cmd=playInfo&hash=' + h, 'https://m.kugou.com/', { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_3 like Mac OS X)' });
  if (d._proxy_error) return { url: null };
  return d.url ? { url: d.url, bitrate: (d.bitRate || 128) + 'kbps', platform: 'kugou' } : { url: null };
}

// ─── Kuwo ───
async function kuwoRequest(url) {
  const headers = { 'User-Agent': UA, 'Accept': 'application/json', 'Referer': 'https://www.kuwo.cn/', 'Cookie': 'Hm_Iuvt=1', 'csrf': '1' };
  const r = await fetch(url, { headers, redirect: 'follow' });
  const t = await r.text();
  try { return JSON.parse(t); } catch { return { _proxy_error: true, status: r.status, body: t.slice(0, 500) }; }
}

async function kwSearch(kw, pg) {
  const pn = (pg || 1) - 1;
  const url = `https://www.kuwo.cn/search/searchMusicBykeyWord?vipver=1&client=kt&ft=music&cluster=0&strategy=2012&encoding=utf8&rformat=json&mobi=1&issubtitle=1&show_copyright_off=1&pn=${pn}&rn=20&all=${encodeURIComponent(kw)}`;
  try {
    const d = await kuwoRequest(url);
    if (d._proxy_error) {
      const d2 = await proxyGet(url, 'https://www.kuwo.cn/', { 'csrf': '1', 'Cookie': 'Hm_Iuvt=1' });
      if (d2._proxy_error) return { result: [], total: 0 };
      return formatKuwoResults(d2);
    }
    return formatKuwoResults(d);
  } catch (e) { return { result: [], total: 0, error: e.message }; }
}

function formatKuwoResults(d) {
  const list = d.abslist || [];
  return { result: list.map(s => ({
    id: 'kwtrack_' + s.DC_TARGETID, title: htmlDecode(s.NAME),
    artist: htmlDecode(s.ARTIST), artist_id: 'kwartist_' + s.ARTISTID,
    album: htmlDecode(s.ALBUM), album_id: 'kwalbum_' + s.ALBUMID,
    source: 'kuwo', source_url: 'https://www.kuwo.cn/play_detail/' + s.DC_TARGETID,
    img_url: s.web_albumpic_short ? `https://img2.kuwo.cn/star/albumcover/${s.web_albumpic_short}` : '',
    duration: parseInt(s.DURATION || 0), lyric_url: s.DC_TARGETID,
  })), total: parseInt(d.HIT || d.TOTAL || 0) };
}

async function kwBootstrap(tid) {
  const songId = tid.replace('kwtrack_', '');
  const url = `https://www.kuwo.cn/api/v1/www/music/playUrl?mid=${songId}&type=music&httpsStatus=1&reqId=&plat=web_www&from=`;
  const d = await kuwoRequest(url);
  if (d._proxy_error) return { url: null };
  if (d.data && d.data.url) return { url: d.data.url, platform: 'kuwo' };
  return { url: null };
}

// ─── Bilibili ───
const BI_COOKIES = 'buvid3=0; buvid4=0; b_nut=0; buvid_fp=0; fingerprint=0; CURRENT_FNVAL=16';

async function biSearch(kw, pg) {
  const url = 'https://api.bilibili.com/x/web-interface/search/type?__refresh__=true&page=' + (pg || 1) + '&page_size=20&platform=pc&highlight=1&keyword=' + encodeURIComponent(kw) + '&search_type=video';
  const d = await proxyGet(url, 'https://www.bilibili.com/', { 'Cookie': BI_COOKIES, 'Origin': 'https://www.bilibili.com' });
  if (d._proxy_error) return d;
  const s = d.data?.result || [];
  return { result: s.map(x => biFormat(x)), total: d.data?.numResults || 0 };
}

function biFormat(x) {
  let imgUrl = x.pic || '';
  if (imgUrl.startsWith('//')) imgUrl = 'https:' + imgUrl;
  return {
    id: 'bitrack_v_' + x.bvid, title: (x.title || '').replace(/<em class="keyword">|<\/em>/g, ''),
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
    const info = await proxyGet('https://api.bilibili.com/x/web-interface/view?bvid=' + bvid, 'https://www.bilibili.com/', { 'Cookie': BI_COOKIES });
    if (info._proxy_error) return { url: null };
    cid = info.data?.pages?.[0]?.cid;
  }
  if (!cid) return { url: null };
  const d = await proxyGet('https://api.bilibili.com/x/player/playurl?fnval=16&bvid=' + bvid + '&cid=' + cid, 'https://www.bilibili.com/', { 'Cookie': BI_COOKIES });
  if (d._proxy_error) return { url: null };
  const au = d.data?.dash?.audio?.[0]?.baseUrl;
  if (au) return { url: au, platform: 'bilibili' };
  const d2 = await proxyGet('https://api.bilibili.com/x/player/playurl?fnval=0&bvid=' + bvid + '&cid=' + cid, 'https://www.bilibili.com/', { 'Cookie': BI_COOKIES });
  if (d2._proxy_error) return { url: null };
  const durl = d2.data?.durl?.[0]?.url;
  return durl ? { url: durl, platform: 'bilibili' } : { url: null };
}

async function biPopular() {
  const d = await proxyGet('https://api.bilibili.com/x/web-interface/popular?ps=20', 'https://www.bilibili.com/', { 'Cookie': BI_COOKIES, 'Origin': 'https://www.bilibili.com' });
  if (d._proxy_error) return [];
  return (d.data?.list || []).map(v => ({
    id: 'bitrack_v_' + v.bvid, title: v.title,
    artist: v.owner?.name || '', artist_id: 'biartist_v_' + (v.owner?.mid || ''),
    source: 'bilibili', source_url: 'https://www.bilibili.com/' + v.bvid,
    img_url: (v.pic || '').startsWith('//') ? 'https:' + v.pic : (v.pic || ''),
    duration: parseDur(String(v.duration || '')),
  }));
}

// ─── Migu ───
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

// ─── GitHub OAuth ───
const GH_CLIENT_ID = 'Ov23ctkJECWXQUnMCtqo';
const GH_CLIENT_SECRET = '383de452c685dded6a147e3a5daabd5abc94b527';
const GH_REDIRECT = 'https://ddmusic.eu.cc/api/auth/callback/github';

async function githubOAuth(code) {
  // Step 1: Exchange code for access token
  const tokenR = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'User-Agent': UA },
    body: JSON.stringify({ client_id: GH_CLIENT_ID, client_secret: GH_CLIENT_SECRET, code: code }),
  });
  const tokenText = await tokenR.text();
  let d;
  try { d = JSON.parse(tokenText); } catch { return { ok: false, error: 'Token exchange parse error: ' + tokenText.slice(0, 100) }; }
  if (d.error) return { ok: false, error: d.error_description || d.error };
  const token = d.access_token;
  if (!token) return { ok: false, error: 'No access_token in response' };

  // Step 2: Get user info with token
  const userR = await fetch('https://api.github.com/user', {
    headers: { 'Authorization': 'token ' + token, 'Accept': 'application/json', 'User-Agent': UA },
  });
  const userText = await userR.text();
  let user;
  try { user = JSON.parse(userText); } catch { return { ok: false, error: 'User API parse error: ' + userText.slice(0, 100) }; }
  if (user.message) return { ok: false, error: 'GitHub API error: ' + user.message };

  return {
    ok: true,
    token: token,
    id: user.id,
    login: user.login,
    name: user.name || user.login,
    avatar: user.avatar_url,
  };
}

// ─── D1 User Database ───
async function dbUpsertUser(db, ghData) {
  if (!db) return null;
  // Check if user exists
  const existing = await db.prepare('SELECT id FROM users WHERE github_id = ?').bind(ghData.id).first();
  if (existing) {
    await db.prepare(
      'UPDATE users SET github_login=?, github_name=?, github_avatar=?, github_token=?, updated_at=datetime(\'now\') WHERE github_id=?'
    ).bind(ghData.login, ghData.name, ghData.avatar, ghData.token, ghData.id).run();
    return existing.id;
  } else {
    const result = await db.prepare(
      'INSERT INTO users (github_id, github_login, github_name, github_avatar, github_token) VALUES (?, ?, ?, ?, ?)'
    ).bind(ghData.id, ghData.login, ghData.name, ghData.avatar, ghData.token).run();
    return result.meta?.last_row_id || null;
  }
}

async function dbGetUserByGithub(db, githubId) {
  if (!db) return null;
  return await db.prepare('SELECT * FROM users WHERE github_id = ?').bind(githubId).first();
}

async function dbUpdateNetease(db, userId, cookie, uid, nickname, avatar) {
  if (!db) return;
  await db.prepare(
    'UPDATE users SET netease_cookie=?, netease_uid=?, netease_nickname=?, netease_avatar=?, updated_at=datetime(\'now\') WHERE id=?'
  ).bind(cookie, uid, nickname, avatar, userId).run();
}

async function dbAddFavorite(db, userId, songId, title, artist, cover, source) {
  if (!db) return;
  await db.prepare(
    'INSERT OR IGNORE INTO favorites (user_id, song_id, song_title, song_artist, song_cover, song_source) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(userId, songId, title, artist, cover, source).run();
}

async function dbRemoveFavorite(db, userId, songId) {
  if (!db) return;
  await db.prepare('DELETE FROM favorites WHERE user_id=? AND song_id=?').bind(userId, songId).run();
}

async function dbGetFavorites(db, userId) {
  if (!db) return [];
  const result = await db.prepare('SELECT * FROM favorites WHERE user_id=? ORDER BY created_at DESC').bind(userId).all();
  return result.results || [];
}

async function dbAddListenHistory(db, userId, songId, title, artist, source) {
  if (!db) return;
  await db.prepare(
    'INSERT INTO listen_history (user_id, song_id, song_title, song_artist, song_source) VALUES (?, ?, ?, ?, ?)'
  ).bind(userId, songId, title, artist, source).run();
}

async function dbGetListenHistory(db, userId, limit) {
  if (!db) return [];
  const result = await db.prepare('SELECT * FROM listen_history WHERE user_id=? ORDER BY listened_at DESC LIMIT ?').bind(userId, limit || 50).all();
  return result.results || [];
}

// ─── Router ───
async function apiRouter(url, env) {
  const a = url.searchParams.get('action'), p = url.searchParams.get('platform');
  const kw = url.searchParams.get('keyword'), tid = url.searchParams.get('trackId');
  const lid = url.searchParams.get('listId'), ex = url.searchParams.get('extra');
  const pg = parseInt(url.searchParams.get('page') || '1');
  const uid = url.searchParams.get('uid');
  const cookie = url.searchParams.get('cookie');

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
        if (p === 'kugou') return [];
        if (p === 'kuwo') return [];
        if (p === 'migu') return [];
        return [];

      case 'discover':
        if (p === 'netease') return neDiscover();
        return [];

      case 'playlist':
        if (p === 'netease') return nePlaylistTracks(lid);
        return { tracks: [], info: {} };

      case 'lyric':
        if (p === 'netease') return neLyric(tid);
        return { lyric: '' };

      case 'login_check':
        if (p === 'netease') return neLoginCheck(cookie);
        return { ok: false, error: 'unsupported platform' };

      case 'user_playlist':
        if (p === 'netease') return neUserPlaylists(uid, cookie);
        return { playlists: [] };

      case 'oauth_url':
        return { url: 'https://github.com/login/oauth/authorize?client_id=' + GH_CLIENT_ID + '&redirect_uri=' + encodeURIComponent(GH_REDIRECT) + '&scope=user:email' };

      // ─── D1 User APIs ───
      case 'user_info': {
        const ghId = parseInt(url.searchParams.get('github_id') || '0');
        if (!ghId) return { ok: false, error: 'missing github_id' };
        const user = await dbGetUserByGithub(env?.dd_music_db, ghId);
        if (!user) return { ok: false, error: 'user not found' };
        return { ok: true, user: { id: user.id, github_login: user.github_login, github_name: user.github_name, github_avatar: user.github_avatar, netease_uid: user.netease_uid, netease_nickname: user.netease_nickname, netease_avatar: user.netease_avatar, netease_logged_in: !!user.netease_cookie } };
      }

      case 'netease_bind': {
        const ghId = parseInt(url.searchParams.get('github_id') || '0');
        const neCookie = url.searchParams.get('ne_cookie') || '';
        if (!ghId || !neCookie) return { ok: false, error: 'missing params' };
        const user = await dbGetUserByGithub(env?.dd_music_db, ghId);
        if (!user) return { ok: false, error: 'user not found' };
        const check = await neLoginCheck(neCookie);
        if (!check.ok) return { ok: false, error: check.error };
        await dbUpdateNetease(env?.dd_music_db, user.id, neCookie, String(check.uid), check.nickname, check.avatar || '');
        return { ok: true, uid: check.uid, nickname: check.nickname, avatar: check.avatar };
      }

      case 'favorite_add': {
        const ghId = parseInt(url.searchParams.get('github_id') || '0');
        const songId = url.searchParams.get('song_id') || '';
        if (!ghId || !songId) return { ok: false, error: 'missing params' };
        const user = await dbGetUserByGithub(env?.dd_music_db, ghId);
        if (!user) return { ok: false, error: 'user not found' };
        await dbAddFavorite(env?.dd_music_db, user.id, songId, url.searchParams.get('song_title') || '', url.searchParams.get('song_artist') || '', url.searchParams.get('song_cover') || '', url.searchParams.get('song_source') || '');
        return { ok: true };
      }

      case 'favorite_remove': {
        const ghId = parseInt(url.searchParams.get('github_id') || '0');
        const songId = url.searchParams.get('song_id') || '';
        if (!ghId || !songId) return { ok: false, error: 'missing params' };
        const user = await dbGetUserByGithub(env?.dd_music_db, ghId);
        if (!user) return { ok: false, error: 'user not found' };
        await dbRemoveFavorite(env?.dd_music_db, user.id, songId);
        return { ok: true };
      }

      case 'favorite_list': {
        const ghId = parseInt(url.searchParams.get('github_id') || '0');
        if (!ghId) return { ok: false, error: 'missing github_id' };
        const user = await dbGetUserByGithub(env?.dd_music_db, ghId);
        if (!user) return { ok: false, error: 'user not found' };
        const favs = await dbGetFavorites(env?.dd_music_db, user.id);
        return { ok: true, favorites: favs };
      }

      case 'listen_record': {
        const ghId = parseInt(url.searchParams.get('github_id') || '0');
        const songId = url.searchParams.get('song_id') || '';
        if (!ghId || !songId) return { ok: false, error: 'missing params' };
        const user = await dbGetUserByGithub(env?.dd_music_db, ghId);
        if (!user) return { ok: false, error: 'user not found' };
        await dbAddListenHistory(env?.dd_music_db, user.id, songId, url.searchParams.get('song_title') || '', url.searchParams.get('song_artist') || '', url.searchParams.get('song_source') || '');
        return { ok: true };
      }

      case 'listen_history': {
        const ghId = parseInt(url.searchParams.get('github_id') || '0');
        if (!ghId) return { ok: false, error: 'missing github_id' };
        const user = await dbGetUserByGithub(env?.dd_music_db, ghId);
        if (!user) return { ok: false, error: 'user not found' };
        const history = await dbGetListenHistory(env?.dd_music_db, user.id, 50);
        return { ok: true, history: history };
      }

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

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST', 'Access-Control-Allow-Headers': '*', 'Access-Control-Max-Age': '86400' }
      });
    }

    // GitHub OAuth callback: /api/auth/callback/github?code=xxx
    if (url.pathname === '/api/auth/callback/github') {
      try {
        const code = url.searchParams.get('code');
        if (!code) return new Response('Missing code', { status: 400 });
        const result = await githubOAuth(code);
        if (result.ok && env?.dd_music_db) {
          await dbUpsertUser(env.dd_music_db, result);
        }
        // DUAL delivery: hash fragment + cookie (belt & suspenders)
        const redirectUrl = '/#oauth=' + encodeURIComponent(JSON.stringify(result));
        const headers = {
          'Location': new URL(redirectUrl, request.url).toString(),
          'Cache-Control': 'no-store',
        };
        // Set a cookie as backup - some browsers lose hash fragments on 302 redirect
        if (result.ok) {
          const cookieData = JSON.stringify({ok:true, t:result.token, l:result.login, n:result.name, a:result.avatar, i:String(result.id)});
          headers['Set-Cookie'] = 'dd_oauth=' + encodeURIComponent(cookieData) + '; Path=/; Max-Age=60; SameSite=Lax; Secure';
        }
        return new Response(null, { status: 302, headers });
      } catch (e) {
        return Response.redirect(new URL('/#oauth_error=' + encodeURIComponent(e.message), request.url).toString(), 302);
      }
    }

    if (url.pathname.startsWith('/api/')) {
      const result = await apiRouter(url, env);
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=60' }
      });
    }

    // Static assets - no-cache HTML to prevent stale version references
    if (env?.ASSETS) {
      const resp = await env.ASSETS.fetch(request);
      if (url.pathname === '/' || url.pathname.endsWith('.html')) {
        const headers = new Headers(resp.headers);
        headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
        headers.set('Pragma', 'no-cache');
        return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers });
      }
      return resp;
    }
    return new Response('Not found', { status: 404 });
  }
};
