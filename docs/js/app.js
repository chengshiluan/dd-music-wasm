// === DD Music v3.1 - GitHub Login + Theme + Song Actions + Responsive ===
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

// -- State --
let currentView = 'home';
let currentPlatform = 'netease';
let currentPlaylist = null;
let discoverData = [];
let playlists = [];
let songs = [];
let queue = [];
let currentIndex = -1;
let isPlaying = false;
let drawerOpen = false;
let nowPlayingOpen = false;
let currentSong = null;
let lyricLines = [];
let activeLyricIdx = -1;
let loopMode = 'none'; // none | one | all
let favorites = [];

// -- User state (localStorage) --
let userState = {
  netease: { cookie: '', uid: '', nickname: '', avatar: '', loggedIn: false },
  github: { token: '', login: '', name: '', avatar: '', loggedIn: false },
};
function loadUserState() {
  try {
    var saved = localStorage.getItem('dd_music_user');
    if (saved) userState = JSON.parse(saved);
  } catch {}
}
function saveUserState() {
  try { localStorage.setItem('dd_music_user', JSON.stringify(userState)); } catch {}
}
loadUserState();

function loadFavorites() {
  try {
    var saved = localStorage.getItem('dd_music_favorites');
    if (saved) favorites = JSON.parse(saved);
  } catch {}
}
function saveFavorites() {
  try { localStorage.setItem('dd_music_favorites', JSON.stringify(favorites)); } catch {}
}
loadFavorites();

const audio = $('#audio');
const volumeSlider = $('#volumeBar');
const volumeFill = $('#volumeFill');
let volume = 0.7;
audio.volume = volume;

// -- Theme --
let isDark = true;
function initTheme() {
  var saved = localStorage.getItem('dd_music_theme');
  if (saved === 'light') { isDark = false; document.body.classList.add('light-theme'); }
  updateThemeIcons();
}
function toggleTheme() {
  isDark = !isDark;
  document.body.classList.toggle('light-theme', !isDark);
  localStorage.setItem('dd_music_theme', isDark ? 'dark' : 'light');
  updateThemeIcons();
}
function updateThemeIcons() {
  $('.icon-sun').style.display = isDark ? '' : 'none';
  $('.icon-moon').style.display = isDark ? 'none' : '';
}
$('#btnTheme').addEventListener('click', toggleTheme);
initTheme();

// -- API --
const API_BASE = '/api/';
function apiUrl(params) { var u = new URLSearchParams(params); return API_BASE + '?' + u.toString(); }
async function apiCall(params) { var res = await fetch(apiUrl(params)); if (!res.ok) throw new Error('API ' + res.status); return res.json(); }

// -- Helpers --
function escHtml(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function https(url) { return url ? url.replace(/^http:/, 'https:') : ''; }
function fmtCount(n) { if (!n) return ''; if (n >= 1e8) return (n / 1e8).toFixed(1) + '亿'; if (n >= 1e4) return (n / 1e4).toFixed(0) + '万'; return String(n); }
function fmtTime(s) { var m = Math.floor(s / 60); return m + ':' + String(Math.floor(s % 60)).padStart(2, '0'); }
function isFav(songId) { return favorites.some(function(f) { return f.id === songId; }); }

// -- View switching --
function switchView(view) {
  currentView = view;
  $('#viewHome').style.display = view === 'home' ? '' : 'none';
  $('#viewDetail').style.display = view === 'detail' ? '' : 'none';
  $('#viewSearch').style.display = view === 'search' ? '' : 'none';
  $('#viewMine').style.display = view === 'mine' ? '' : 'none';
  $('#breadcrumb').style.display = (view === 'detail' || view === 'search') ? '' : 'none';
}

// -- Drawer --
function openDrawer() { drawerOpen = true; $('#queueDrawer').classList.add('open'); $('#drawerBackdrop').classList.add('open'); }
function closeDrawer() { drawerOpen = false; $('#queueDrawer').classList.remove('open'); $('#drawerBackdrop').classList.remove('open'); }
$('#btnQueue').addEventListener('click', function() { drawerOpen ? closeDrawer() : openDrawer(); });
$('#closeDrawer').addEventListener('click', closeDrawer);
$('#drawerBackdrop').addEventListener('click', closeDrawer);

// -- Now Playing --
function openNowPlaying() {
  if (!currentSong) return;
  nowPlayingOpen = true;
  $('#nowPlaying').style.display = '';
  document.body.style.overflow = 'hidden';
  updateNowPlayingPage();
  loadLyric(currentSong);
}
function closeNowPlaying() {
  nowPlayingOpen = false;
  $('#nowPlaying').style.display = 'none';
  document.body.style.overflow = '';
}
$('#playerCoverWrap').addEventListener('click', openNowPlaying);
$('#npClose').addEventListener('click', closeNowPlaying);

function updateNowPlayingPage() {
  if (!currentSong) return;
  var title = currentSong.title || currentSong.name || '未知';
  var artist = currentSong.artist || '';
  var album = currentSong.album || '';
  var cover = https(currentSong.img_url || currentSong.cover || '');
  $('#npTitle').textContent = title;
  $('#npArtist').textContent = artist;
  $('#npAlbum').textContent = album;
  if (cover) {
    $('#npBg').style.backgroundImage = 'url(' + cover + ')';
    $('#npLabel').style.backgroundImage = 'url(' + cover + ')';
  }
}

// -- Lyric parsing & sync --
function parseLRC(lrcText) {
  if (!lrcText) return [];
  var lines = lrcText.split('\n');
  var result = [];
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    var m = line.match(/^\[(\d{2}):(\d{2})\.(\d{2,3})\]\s*(.*)/);
    if (m) {
      var time = parseInt(m[1]) * 60 + parseInt(m[2]) + parseInt(m[3]) / (m[3].length === 2 ? 100 : 1000);
      var text = m[4].trim();
      if (text) result.push({ time: time, text: text });
    }
  }
  result.sort(function(a, b) { return a.time - b.time; });
  return result;
}

async function loadLyric(song) {
  var trackId = song.id || '';
  var plat = song.source || currentPlatform;
  $('#npLyrics').innerHTML = '<div class="lyrics-placeholder">加载歌词...</div>';
  try {
    var data = await apiCall({ action: 'lyric', platform: plat, trackId: trackId });
    lyricLines = parseLRC(data.lyric || '');
    if (!lyricLines.length) {
      $('#npLyrics').innerHTML = '<div class="lyrics-placeholder">暂无歌词</div>';
      return;
    }
    var html = lyricLines.map(function(l, i) {
      return '<div class="lyric-line" data-idx="' + i + '">' + escHtml(l.text) + '</div>';
    }).join('');
    $('#npLyrics').innerHTML = html;
  } catch (e) {
    console.error(e);
    $('#npLyrics').innerHTML = '<div class="lyrics-placeholder">歌词加载失败</div>';
  }
}

function syncLyric(currentTime) {
  if (!lyricLines.length || !nowPlayingOpen) return;
  var idx = -1;
  for (var i = lyricLines.length - 1; i >= 0; i--) {
    if (currentTime >= lyricLines[i].time) { idx = i; break; }
  }
  if (idx === activeLyricIdx) return;
  activeLyricIdx = idx;
  var lines = $$('#npLyrics .lyric-line');
  lines.forEach(function(el, i) {
    if (i === idx) el.classList.add('active');
    else el.classList.remove('active');
  });
  if (idx >= 0 && lines[idx]) {
    var container = $('#npLyrics');
    var lineEl = lines[idx];
    container.scrollTop = lineEl.offsetTop - container.clientHeight / 2 + lineEl.clientHeight / 2;
  }
}

// -- Home: categorized playlists --
async function loadHome() {
  var container = $('#discoverContainer');
  container.innerHTML = '<div class="loading"><div class="spinner"></div><span>加载歌单...</span></div>';
  try {
    if (currentPlatform === 'netease') {
      var data = await apiCall({ action: 'discover', platform: 'netease' });
      discoverData = Array.isArray(data) ? data : [];
      if (!discoverData.length) { container.innerHTML = '<div class="empty-hint">暂无推荐歌单</div>'; return; }
      container.innerHTML = discoverData.map(function(cat) {
        return '<div class="category-section"><div class="category-header"><div class="category-name">' + escHtml(cat.category) + '</div></div>' +
          '<div class="playlist-grid">' +
          cat.playlists.map(function(p, i) {
            var cover = https(p.cover_img_url || '');
            return '<div class="playlist-card" data-cat="' + escHtml(cat.category) + '" data-idx="' + i + '">' +
              '<div class="card-cover"><img src="' + cover + '" alt="" loading="lazy"><div class="card-play-overlay"><div class="card-play-btn"><svg viewBox="0 0 24 24" width="18" height="18" fill="white"><path d="M8 5v14l11-7z"/></svg></div></div></div>' +
              '<div class="card-title">' + escHtml(p.title || '') + '</div></div>';
          }).join('') + '</div></div>';
      }).join('');
    } else {
      var data = await apiCall({ action: 'chart', platform: currentPlatform });
      playlists = Array.isArray(data) ? data : (data.playlists || data.list || []);
      if (!playlists.length) { container.innerHTML = '<div class="empty-hint">该平台暂无推荐歌单</div>'; return; }
      container.innerHTML = '<div class="category-section"><div class="category-header"><div class="category-name">推荐歌单</div></div>' +
        '<div class="playlist-grid">' +
        playlists.map(function(p, i) {
          var cover = https(p.cover_img_url || p.cover || p.img || '');
          return '<div class="playlist-card" data-chart-idx="' + i + '">' +
            '<div class="card-cover"><img src="' + cover + '" alt="" loading="lazy"><div class="card-play-overlay"><div class="card-play-btn"><svg viewBox="0 0 24 24" width="18" height="18" fill="white"><path d="M8 5v14l11-7z"/></svg></div></div></div>' +
            '<div class="card-title">' + escHtml(p.title || p.name || '') + '</div></div>';
        }).join('') + '</div></div>';
    }
    bindPlaylistCards(container);
  } catch (e) {
    console.error(e);
    container.innerHTML = '<div class="empty-hint">加载失败，请重试</div>';
  }
}

function bindPlaylistCards(container) {
  container.querySelectorAll('.playlist-card[data-cat]').forEach(function(card) {
    card.addEventListener('click', function() {
      var cat = discoverData.find(function(c) { return c.category === card.dataset.cat; });
      if (cat && cat.playlists[parseInt(card.dataset.idx)]) openPlaylist(cat.playlists[parseInt(card.dataset.idx)]);
    });
  });
  container.querySelectorAll('.playlist-card[data-chart-idx]').forEach(function(card) {
    card.addEventListener('click', function() { var idx = parseInt(card.dataset.chartIdx); if (playlists[idx]) openPlaylist(playlists[idx]); });
  });
}

// -- My Music page --
function renderMinePage() {
  var platforms = [
    { key: 'netease', name: '网易云', color: '#D81E06' },
    { key: 'qq', name: 'QQ音乐', color: '#31c27c' },
    { key: 'kugou', name: '酷狗', color: '#2e8bff' },
    { key: 'kuwo', name: '酷我', color: '#ffcc00' },
    { key: 'migu', name: '咪咕', color: '#e5004f' },
    { key: 'bilibili', name: 'B站', color: '#fb7299' },
  ];

  var sidebar = $('#mineSidebar');
  sidebar.innerHTML = platforms.map(function(p) {
    var loggedIn = userState[p.key] && userState[p.key].loggedIn;
    return '<div class="mine-platform" data-platform="' + p.key + '">' +
      '<span class="mine-plat-dot" style="background:' + p.color + '"></span>' +
      '<span class="mine-plat-name">' + p.name + '</span>' +
      '<span class="mine-plat-status ' + (loggedIn ? 'logged-in' : '') + '">' + (loggedIn ? '✓' : '未登录') + '</span></div>';
  }).join('');

  sidebar.querySelectorAll('.mine-platform').forEach(function(el) {
    el.addEventListener('click', function() {
      sidebar.querySelectorAll('.mine-platform').forEach(function(e) { e.classList.remove('active'); });
      el.classList.add('active');
      loadMyPlaylists(el.dataset.platform);
    });
  });

  // Auto-select netease if logged in
  if (userState.netease.loggedIn) {
    var ne = sidebar.querySelector('.mine-platform[data-platform="netease"]');
    if (ne) { ne.classList.add('active'); loadMyPlaylists('netease'); }
  }
}

async function loadMyPlaylists(platform) {
  var content = $('#mineContent');
  // Only netease is supported for now
  if (platform === 'netease') {
    content.innerHTML = '<div class="loading"><div class="spinner"></div><span>检测登录状态...</span></div>';
    // Auto-read cookie from localStorage
    try {
      var cookie = userState.netease.cookie;
      var uid = userState.netease.uid;
      if (!cookie || !uid) {
        // Try auto-login: check if we have stored data
        await new Promise(function(r) { setTimeout(r, 1000); });
        if (!userState.netease.cookie) {
          content.innerHTML = '<div class="empty-hint"><p>请先在网页上登录网易云</p><p style="font-size:11px;color:var(--text3);margin-top:6px">登录之后再回来操作</p></div>';
          return;
        }
      }
      content.innerHTML = '<div class="loading"><div class="spinner"></div><span>加载我的歌单...</span></div>';
      var data = await apiCall({ action: 'user_playlist', platform: 'netease', uid: uid, cookie: cookie });
      var pls = data.playlists || [];
      if (!pls.length) { content.innerHTML = '<div class="empty-hint">暂无歌单</div>'; return; }
      content.innerHTML = '<div class="category-header"><div class="category-name">我的网易云歌单</div></div>' +
        '<div class="playlist-grid">' +
        pls.map(function(p, i) {
          var cover = https(p.cover_img_url || '');
          return '<div class="playlist-card" data-mine-idx="' + i + '">' +
            '<div class="card-cover"><img src="' + cover + '" alt="" loading="lazy"><div class="card-play-overlay"><div class="card-play-btn"><svg viewBox="0 0 24 24" width="18" height="18" fill="white"><path d="M8 5v14l11-7z"/></svg></div></div></div>' +
            '<div class="card-title">' + escHtml(p.title || '') + '</div></div>';
        }).join('') + '</div>';
      playlists = pls;
      content.querySelectorAll('.playlist-card[data-mine-idx]').forEach(function(card) {
        card.addEventListener('click', function() { var idx = parseInt(card.dataset.mineIdx); if (playlists[idx]) openPlaylist(playlists[idx]); });
      });
    } catch (e) { console.error(e); content.innerHTML = '<div class="empty-hint">加载失败</div>'; }
  } else {
    // Other platforms: not yet available
    content.innerHTML = '<div class="empty-hint"><p style="font-size:14px">功能暂未开放</p><p style="font-size:11px;color:var(--text3);margin-top:6px">该平台登录功能即将上线</p></div>';
  }
}

// -- Login (GitHub Only) --
function openLoginModal() { $('#loginModal').style.display = ''; }
$('#btnLogin').addEventListener('click', openLoginModal);
$('#closeLoginModal').addEventListener('click', function() { $('#loginModal').style.display = 'none'; });
$('#loginModal').addEventListener('click', function(e) { if (e.target === $('#loginModal')) $('#loginModal').style.display = 'none'; });

// GitHub login - click the circle icon
$('#ghLoginBtn').addEventListener('click', async function() {
  try {
    var data = await apiCall({ action: 'oauth_url' });
    if (data.url) window.open(data.url, '_blank');
  } catch (e) { showToast('获取授权链接失败'); }
});

// Handle OAuth callback (from URL hash)
function checkOAuthCallback() {
  var hash = location.hash;
  if (hash.startsWith('#oauth=')) {
    try {
      var data = JSON.parse(decodeURIComponent(hash.slice(7)));
      if (data.ok) {
        userState.github = { token: data.token, login: data.login, name: data.name, avatar: https(data.avatar || ''), loggedIn: true };
        saveUserState();
        updateLoginBtn();
        showToast('GitHub登录成功：' + data.name);
        // Save to KV
        saveToKV('gh:' + data.id, JSON.stringify({ login: data.login, name: data.name, avatar: data.avatar }));
      }
    } catch {}
    history.replaceState(null, '', '/');
  }
}

function updateLoginBtn() {
  var btn = $('#btnLogin');
  var defaultIcon = btn.querySelector('.icon-default');
  var avatarImg = $('#loginAvatar');
  if (userState.github.loggedIn && userState.github.avatar) {
    defaultIcon.style.display = 'none';
    avatarImg.src = userState.github.avatar;
    avatarImg.style.display = '';
    btn.title = userState.github.name || '已登录';
  } else {
    defaultIcon.style.display = '';
    avatarImg.style.display = 'none';
    btn.title = '登录';
  }
}

// -- KV helpers --
async function saveToKV(key, data) {
  try { await apiCall({ action: 'store_user', key: key, data: data }); } catch {}
}
async function getFromKV(key) {
  try { return await apiCall({ action: 'get_user', key: key }); } catch { return null; }
}

// -- Song Actions: Favorite, Download, Share --
async function toggleFavorite(song) {
  var id = song.id || '';
  if (!id) return;
  var idx = favorites.findIndex(function(f) { return f.id === id; });
  if (idx >= 0) {
    favorites.splice(idx, 1);
    showToast('取消收藏');
  } else {
    var favItem = { id: id, title: song.title || song.name || '', artist: song.artist || '', img_url: https(song.img_url || song.cover || ''), source: song.source || currentPlatform, ts: Date.now() };
    favorites.push(favItem);
    showToast('已收藏');
    // Save to KV
    if (userState.github.loggedIn) {
      saveToKV('fav:' + userState.github.login, JSON.stringify(favorites));
    }
  }
  saveFavorites();
  // Re-render song list to update heart icons
  if (currentView === 'detail') renderSongList($('#songList'), songs);
  else if (currentView === 'search') renderSongList($('#searchList'), songs);
}

async function downloadSong(song) {
  var trackId = song.id || '';
  if (!trackId) return;
  showToast('获取下载链接...');
  try {
    var plat = song.source || currentPlatform;
    var data = await apiCall({ action: 'bootstrap', platform: plat, trackId: trackId });
    if (data.url) {
      var a = document.createElement('a');
      a.href = data.url;
      a.download = (song.title || song.name || 'music') + '.mp3';
      a.target = '_blank';
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast('开始下载');
    } else {
      showToast('暂无下载源');
    }
  } catch (e) { showToast('下载失败'); }
}

function shareSong(song) {
  var id = song.id || '';
  var plat = song.source || currentPlatform;
  var title = song.title || song.name || '分享音乐';
  var artist = song.artist || '';
  var shareUrl = 'https://ddmusic.eu.cc/#play=' + plat + '_' + encodeURIComponent(id);
  var text = title + ' - ' + artist + ' | 顶点音乐 ' + shareUrl;
  if (navigator.share) {
    navigator.share({ title: title + ' - ' + artist, text: '来自顶点音乐', url: shareUrl }).catch(function() {});
  } else {
    // Copy to clipboard
    navigator.clipboard.writeText(text).then(function() { showToast('链接已复制到剪贴板'); }).catch(function() { showToast('分享失败'); });
  }
}

// -- Playlist detail --
async function openPlaylist(p) {
  currentPlaylist = p;
  switchView('detail');
  $('#breadcrumbTitle').textContent = p.title || p.name || '歌单';
  var cover = https(p.cover_img_url || p.cover || p.img || p.picUrl || p.pic || '');
  var name = p.title || p.name || '未知歌单';
  $('#detailHeader').innerHTML =
    '<div class="detail-cover"><img src="' + cover + '" alt=""></div>' +
    '<div class="detail-info"><div class="detail-name">' + escHtml(name) + '</div>' +
    '<button class="btn-play-all" id="btnPlayAll">播放全部</button></div>';
  var list = $('#songList');
  list.innerHTML = '<div class="loading"><div class="spinner"></div><span>加载歌曲...</span></div>';
  try {
    var listId = p.id || p.listId || '';
    var data = await apiCall({ action: 'chart', platform: currentPlatform, listId: listId });
    songs = data.tracks || data.list || (Array.isArray(data) ? data : []);
    if (!songs.length) { list.innerHTML = '<div class="empty-hint">歌单内暂无歌曲</div>'; return; }
    renderSongList(list, songs);
    var playAllBtn = $('#btnPlayAll');
    if (playAllBtn) playAllBtn.addEventListener('click', function() { playAll(songs); });
  } catch (e) { console.error(e); list.innerHTML = '<div class="empty-hint">加载失败</div>'; }
}

function renderSongList(container, list) {
  container.innerHTML = list.map(function(s, i) {
    var title = s.title || s.name || '未知';
    var artist = s.artist || s.artistsname || s.author || '';
    var album = s.album || s.albumname || '';
    var cover = https(s.img_url || s.cover || s.img || s.picUrl || (s.al && s.al.picUrl) || '');
    var dur = s.duration || 0;
    var fav = isFav(s.id || '');
    return '<div class="song-item" data-idx="' + i + '">' +
      '<div class="song-idx">' + (i + 1) + '</div>' +
      '<div class="song-cover"><img src="' + cover + '" alt="" loading="lazy"></div>' +
      '<div class="song-info"><div class="song-title">' + escHtml(title) + '</div>' +
      '<div class="song-sub">' + escHtml(artist) + (album ? ' · ' + escHtml(album) : '') +
      (dur ? ' <span class="song-dur">' + fmtTime(dur) + '</span>' : '') + '</div></div>' +
      '<div class="song-actions">' +
      '<button class="btn-action btn-fav ' + (fav ? 'active' : '') + '" data-idx="' + i + '" title="收藏"><svg viewBox="0 0 24 24" width="14" height="14" fill="' + (fav ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg></button>' +
      '<button class="btn-action btn-add-queue" data-idx="' + i + '" title="加入队列"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg></button>' +
      '<button class="btn-action btn-download" data-idx="' + i + '" title="下载"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg></button>' +
      '<button class="btn-action btn-share" data-idx="' + i + '" title="分享"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98"/></svg></button>' +
      '</div></div>';
  }).join('');
  container.querySelectorAll('.song-item').forEach(function(item) {
    var idx = parseInt(item.dataset.idx);
    // Double click to play
    item.addEventListener('dblclick', function() { playSongFromList(idx); });
    // Single click on song-info to play
    item.querySelector('.song-info').addEventListener('click', function() { playSongFromList(idx); });
    // Action buttons
    item.querySelector('.btn-fav').addEventListener('click', function(e) { e.stopPropagation(); toggleFavorite(list[idx]); });
    item.querySelector('.btn-add-queue').addEventListener('click', function(e) { e.stopPropagation(); addToQueue(idx); });
    item.querySelector('.btn-download').addEventListener('click', function(e) { e.stopPropagation(); downloadSong(list[idx]); });
    item.querySelector('.btn-share').addEventListener('click', function(e) { e.stopPropagation(); shareSong(list[idx]); });
  });
}

// -- Search --
var searchTimer = null;
$('#searchInput').addEventListener('input', function(e) {
  clearTimeout(searchTimer);
  var q = e.target.value.trim();
  if (!q) { if (currentView === 'search') switchView('home'); return; }
  searchTimer = setTimeout(function() { doSearch(q); }, 400);
});
$('#searchInput').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') { clearTimeout(searchTimer); var q = e.target.value.trim(); if (q) doSearch(q); }
});

async function doSearch(query) {
  switchView('search');
  $('#searchTitle').textContent = '搜索：' + query;
  $('#breadcrumbTitle').textContent = '搜索结果';
  var list = $('#searchList');
  list.innerHTML = '<div class="loading"><div class="spinner"></div><span>搜索中...</span></div>';
  try {
    var data = await apiCall({ action: 'search', platform: currentPlatform, keyword: query });
    songs = data.result || data.list || data.tracks || (Array.isArray(data) ? data : []);
    if (!songs.length) { list.innerHTML = '<div class="empty-hint">未找到结果</div>'; return; }
    renderSongList(list, songs);
  } catch (e) { console.error(e); list.innerHTML = '<div class="empty-hint">搜索失败</div>'; }
}

// -- Playback --
async function playSongFromList(idx) {
  var s = songs[idx]; if (!s) return;
  currentIndex = idx; queue = songs.slice(); updateQueueUI();
  showToast('获取播放源...');
  try { var url = await resolveUrl(s); if (url) loadAndPlay(s, url); else showToast('暂无播放源'); }
  catch (e) { showToast('播放失败'); }
}

async function playAll(list) {
  if (!list.length) return;
  queue = list.slice(); songs = list.slice(); currentIndex = 0; updateQueueUI();
  showToast('获取播放源...');
  try { var url = await resolveUrl(queue[0]); if (url) loadAndPlay(queue[0], url); else showToast('暂无播放源'); }
  catch (e) { showToast('播放失败'); }
}

async function resolveUrl(song) {
  var trackId = song.id || ''; if (!trackId) return null;
  var plat = song.source || currentPlatform;
  try { var data = await apiCall({ action: 'bootstrap', platform: plat, trackId: trackId }); return data.url || null; }
  catch (e) { return null; }
}

function loadAndPlay(song, url) {
  audio.src = url;
  audio.play().catch(function(e) { console.warn('play blocked:', e); });
  isPlaying = true; currentSong = song;
  updatePlayBtn(); updateNowPlaying(song); recordListen(song);
}

function updateNowPlaying(song) {
  currentSong = song;
  var title = song.title || song.name || '未知';
  var artist = song.artist || song.artistsname || song.author || '';
  var cover = https(song.img_url || song.cover || song.img || song.picUrl || song.pic || (song.al && song.al.picUrl) || '');
  $('#playerTitle').textContent = title;
  $('#playerArtist').textContent = artist;
  var img = $('#playerCover');
  var logo = $('#playerCoverLogo');
  if (cover) { img.src = cover; img.style.display = ''; logo.style.display = 'none'; }
  else { img.style.display = 'none'; logo.style.display = ''; }
  var pNames = { netease: '网易云', qq: 'QQ音乐', kugou: '酷狗', kuwo: '酷我', bilibili: 'B站', migu: '咪咕' };
  $('#platformBadge').textContent = pNames[currentPlatform] || '';
  document.title = title + ' - ' + artist + ' | 顶点音乐';
  if (nowPlayingOpen) updateNowPlayingPage();
}

function recordListen(song) {
  try {
    var history = JSON.parse(localStorage.getItem('dd_music_listen_history') || '[]');
    history.push({ id: song.id, title: song.title || song.name, artist: song.artist, ts: Date.now() });
    if (history.length > 500) history = history.slice(-500);
    localStorage.setItem('dd_music_listen_history', JSON.stringify(history));
  } catch {}
}

function addToQueue(idx) { var s = songs[idx]; if (!s) return; queue.push(s); updateQueueUI(); showToast('已加入队列'); }
function removeFromQueue(idx) { queue.splice(idx, 1); if (currentIndex >= queue.length) currentIndex = queue.length - 1; updateQueueUI(); }

function updateQueueUI() {
  var list = $('#queueList');
  $('#queueCount').textContent = queue.length;
  var dot = $('#queueDot');
  if (queue.length > 0) dot.classList.add('has-items'); else dot.classList.remove('has-items');
  if (!queue.length) { list.innerHTML = '<div class="empty-hint">播放队列为空</div>'; return; }
  list.innerHTML = queue.map(function(s, i) {
    var title = s.title || s.name || '未知';
    var artist = s.artist || '';
    var cover = https(s.img_url || s.cover || s.img || s.picUrl || (s.al && s.al.picUrl) || '');
    var active = i === currentIndex ? ' active' : '';
    return '<div class="queue-item' + active + '" data-idx="' + i + '">' +
      '<div class="qi-cover"><img src="' + cover + '" alt="" loading="lazy"></div>' +
      '<div class="qi-info"><span class="qi-title">' + escHtml(title) + '</span><span class="qi-artist">' + escHtml(artist) + '</span></div>' +
      '<button class="qi-remove" data-idx="' + i + '"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button></div>';
  }).join('');
  list.querySelectorAll('.queue-item').forEach(function(item) {
    item.addEventListener('click', function(e) {
      if (e.target.closest('.qi-remove')) { removeFromQueue(parseInt(item.dataset.idx)); return; }
      currentIndex = parseInt(item.dataset.idx);
      var s = queue[currentIndex];
      resolveUrl(s).then(function(url) { if (url) loadAndPlay(s, url); });
    });
  });
}

// -- Loop mode --
$('#btnLoop').addEventListener('click', function() {
  if (loopMode === 'none') { loopMode = 'one'; audio.loop = true; showToast('单曲循环'); }
  else if (loopMode === 'one') { loopMode = 'all'; audio.loop = false; showToast('列表循环'); }
  else { loopMode = 'none'; audio.loop = false; showToast('取消循环'); }
  updateLoopIcon();
});
function updateLoopIcon() {
  var icon = $('#loopIcon');
  var btn = $('#btnLoop');
  btn.classList.remove('loop-one', 'loop-all');
  if (loopMode === 'one') { btn.classList.add('loop-one'); icon.innerHTML = '<path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/><text x="12" y="15" text-anchor="middle" font-size="6" fill="currentColor" stroke="none">1</text>'; }
  else if (loopMode === 'all') { btn.classList.add('loop-all'); icon.innerHTML = '<path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/>'; }
  else { icon.innerHTML = '<path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/>'; }
}

// -- Player controls --
$('#btnPlay').addEventListener('click', function() {
  if (!audio.src) return;
  if (isPlaying) { audio.pause(); isPlaying = false; } else { audio.play().catch(function(){}); isPlaying = true; }
  updatePlayBtn();
});
$('#btnPrev').addEventListener('click', function() {
  if (!queue.length) return;
  currentIndex = (currentIndex - 1 + queue.length) % queue.length;
  var s = queue[currentIndex]; resolveUrl(s).then(function(url) { if (url) loadAndPlay(s, url); });
});
$('#btnNext').addEventListener('click', function() {
  if (!queue.length) return;
  if (loopMode === 'all' || loopMode === 'none') { currentIndex = (currentIndex + 1) % queue.length; }
  var s = queue[currentIndex]; resolveUrl(s).then(function(url) { if (url) loadAndPlay(s, url); });
});

// NP controls
$('#npPlay').addEventListener('click', function() { $('#btnPlay').click(); });
$('#npPrev').addEventListener('click', function() { $('#btnPrev').click(); });
$('#npNext').addEventListener('click', function() { $('#btnNext').click(); });
$('#npProgressBar').addEventListener('click', function(e) {
  if (!audio.duration) return;
  var rect = e.currentTarget.getBoundingClientRect();
  audio.currentTime = ((e.clientX - rect.left) / rect.width) * audio.duration;
});

function updatePlayBtn() {
  var icon = $('#playIcon');
  var npIcon = $('#npPlayIcon');
  if (isPlaying) {
    icon.innerHTML = '<path d="M6 4h4v16H6zM14 4h4v16h-4z"/>';
    npIcon.innerHTML = '<path d="M6 4h4v16H6zM14 4h4v16h-4z"/>';
    $('#btnPlay').classList.add('playing'); $('#npPlay').classList.add('playing');
    $('#player').classList.add('active');
    $('#npVinyl').classList.add('spinning');
  } else {
    icon.innerHTML = '<path d="M8 5v14l11-7z"/>';
    npIcon.innerHTML = '<path d="M8 5v14l11-7z"/>';
    $('#btnPlay').classList.remove('playing'); $('#npPlay').classList.remove('playing');
    $('#player').classList.remove('active');
    $('#npVinyl').classList.remove('spinning');
  }
}

// Progress
audio.addEventListener('timeupdate', function() {
  if (!audio.duration) return;
  var pct = (audio.currentTime / audio.duration) * 100;
  $('#progressFill').style.width = pct + '%';
  $('#currentTime').textContent = fmtTime(audio.currentTime);
  $('#duration').textContent = fmtTime(audio.duration);
  if (nowPlayingOpen) {
    $('#npProgressFill').style.width = pct + '%';
    $('#npCurrentTime').textContent = fmtTime(audio.currentTime);
    $('#npDuration').textContent = fmtTime(audio.duration);
    syncLyric(audio.currentTime);
  }
});

$('#progressBar').addEventListener('click', function(e) {
  if (!audio.duration) return;
  var rect = e.currentTarget.getBoundingClientRect();
  audio.currentTime = ((e.clientX - rect.left) / rect.width) * audio.duration;
});

// Volume
$('#btnVolume').addEventListener('click', function() { audio.muted = !audio.muted; updateVolumeIcon(); });
volumeSlider.addEventListener('click', function(e) {
  var rect = e.currentTarget.getBoundingClientRect();
  volume = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  audio.volume = volume; audio.muted = false;
  volumeFill.style.width = (volume * 100) + '%';
  updateVolumeIcon();
});
function updateVolumeIcon() {
  var icon = $('#volumeIcon');
  if (audio.muted || volume === 0) icon.innerHTML = '<path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.56-1.42 1.01-2.25 1.32v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>';
  else icon.innerHTML = '<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>';
}

audio.addEventListener('ended', function() {
  if (loopMode === 'one') return; // handled by audio.loop
  if (queue.length) {
    if (loopMode === 'all') { currentIndex = (currentIndex + 1) % queue.length; }
    else { currentIndex++; if (currentIndex >= queue.length) { isPlaying = false; updatePlayBtn(); return; } }
    var s = queue[currentIndex]; resolveUrl(s).then(function(url) { if (url) loadAndPlay(s, url); });
  }
});
audio.addEventListener('error', function() { showToast('播放失败，可能无版权'); });

// -- Toast --
function showToast(msg) {
  var t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(function() { t.classList.add('show'); });
  setTimeout(function() { t.classList.remove('show'); setTimeout(function() { t.remove(); }, 300); }, 2500);
}

$('#clearPlaylist').addEventListener('click', function() { queue = []; currentIndex = -1; updateQueueUI(); });
$('#btnBack').addEventListener('click', function() { if (currentView !== 'home') { switchView('home'); $('#searchInput').value = ''; } });

// -- Platform tabs --
$$('#platformTabs .platform-tab').forEach(function(tab) {
  tab.addEventListener('click', function() {
    $$('#platformTabs .platform-tab').forEach(function(t) { t.classList.remove('active'); });
    tab.classList.add('active');
    currentPlatform = tab.dataset.platform;
    if (currentPlatform === 'mine') { switchView('mine'); renderMinePage(); }
    else { switchView('home'); loadHome(); }
  });
});

// -- Handle shared play link --
function checkPlayLink() {
  var hash = location.hash;
  if (hash.startsWith('#play=')) {
    var parts = hash.slice(6).split('_');
    var plat = parts[0];
    var trackId = decodeURIComponent(parts.slice(1).join('_'));
    if (plat && trackId) {
      currentPlatform = plat;
      var song = { id: trackId, title: '加载中...', artist: '', source: plat };
      resolveUrl(song).then(function(url) {
        if (url) {
          // Try search to get full info
          apiCall({ action: 'search', platform: plat, keyword: trackId.replace(/^[a-z]+track_/, '') }).then(function(data) {
            var results = data.result || [];
            var found = results.find(function(r) { return r.id === trackId; });
            if (found) loadAndPlay(found, url);
            else { song.title = '分享歌曲'; loadAndPlay(song, url); }
          }).catch(function() { loadAndPlay(song, url); });
        } else showToast('无法播放');
      });
    }
    history.replaceState(null, '', '/');
  }
}

// -- Keyboard --
document.addEventListener('keydown', function(e) {
  if (e.target.tagName === 'INPUT') return;
  if (e.code === 'Space') { e.preventDefault(); $('#btnPlay').click(); }
  if (e.code === 'Escape' && nowPlayingOpen) closeNowPlaying();
});

// -- Init --
checkOAuthCallback();
checkPlayLink();
updateLoginBtn();
loadHome();
