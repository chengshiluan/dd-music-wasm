import init, { Playlist, format_duration } from '../pkg/dd_music_wasm.js';

// ─── State ───
let playlist;
let currentPlatform = 'bilibili';
let currentPlaylistIndex = -1;

const API = '/api/proxy';
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// ─── DOM refs ───
const audio = $('#audio');
const searchInput = $('#searchInput');
const searchBtn = $('#searchBtn');
const songList = $('#songList');
const chartsContainer = $('#chartsContainer');
const loading = $('#loading');
const resultTitle = $('#resultTitle');
const resultCount = $('#resultCount');
const playlistSongs = $('#playlistSongs');
const playlistCount = $('#playlistCount');
const playerTitle = $('#playerTitle');
const playerArtist = $('#playerArtist');
const playerCover = $('#playerCover');
const progressFill = $('#progressFill');
const progressBar = $('#progressBar');
const volumeFill = $('#volumeFill');
const volumeBar = $('#volumeBar');
const currentTimeEl = $('#currentTime');
const durationEl = $('#duration');
const platformBadge = $('#platformBadge');

const platformNames = {
    netease: '网易云', qq: 'QQ音乐', kugou: '酷狗',
    kuwo: '酷我', bilibili: 'B站', migu: '咪咕',
};

const platformColors = {
    netease: '#e60026', qq: '#31c27c', kugou: '#2e8bff',
    kuwo: '#ffcc00', bilibili: '#fb7299', migu: '#e5004f',
};

// ─── Init ───
async function bootstrap() {
    await init();
    playlist = new Playlist();

    $('#platformTabs').addEventListener('click', (e) => {
        const tab = e.target.closest('.platform-tab');
        if (!tab) return;
        currentPlatform = tab.dataset.platform;
        $$('.platform-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        if (searchInput.value.trim()) search();
    });

    searchBtn.addEventListener('click', () => search());
    searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') search(); });

    $('#btnPlay').addEventListener('click', togglePlay);
    $('#btnPrev').addEventListener('click', playPrev);
    $('#btnNext').addEventListener('click', playNext);
    $('#clearPlaylist').addEventListener('click', clearPlaylist);
    progressBar.addEventListener('click', seek);
    volumeBar.addEventListener('click', setVolume);
    $('#btnVolume').addEventListener('click', toggleMute);

    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', onSongEnd);
    audio.addEventListener('error', onAudioError);

    // NetEase import modal
    $('#neteaseImportBtn').addEventListener('click', openImportModal);
    $('#closeImportModal').addEventListener('click', closeImportModal);
    $('#importModal').addEventListener('click', (e) => { if (e.target === $('#importModal')) closeImportModal(); });
    $('#importPlaylistBtn').addEventListener('click', importPlaylist);

    // Chart "play all" buttons
    chartsContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.chart-play-all');
        if (!btn) return;
        const chart = btn.dataset.chart;
        const songs = window['_chartSongs_' + chart];
        if (songs && songs.length) {
            playlist.clear();
            songs.forEach(s => playlist.add_song(JSON.stringify(s)));
            renderPlaylist();
            playSong(0);
            toast(`已添加 ${songs.length} 首`, 'success');
        }
    });

    renderPlaylist();
    loadCharts();
}

// ─── API helpers ───
async function apiCall(params) {
    const qs = new URLSearchParams(params).toString();
    const resp = await fetch(API + '?' + qs);
    const text = await resp.text();
    try { return JSON.parse(text); } catch {
        throw new Error('服务器返回异常，请稍后重试');
    }
}

// ─── Charts ───
async function loadCharts() {
    await Promise.all([loadBilibiliPopular(), loadNeteaseCharts(), loadQQCharts()]);
}

async function loadBilibiliPopular() {
    const container = $('#chartSongsBilibili');
    try {
        const data = await apiCall({ action: 'chart', platform: 'bilibili' });
        if (Array.isArray(data)) { window._chartSongs_bilibili = data; renderChartSongs(container, data); }
        else container.innerHTML = '<div class="chart-loading" style="color:#71717a;">加载失败</div>';
    } catch { container.innerHTML = '<div class="chart-loading" style="color:#71717a;">加载失败</div>'; }
}

async function loadNeteaseCharts() {
    const container = $('#chartSongsNetease');
    try {
        const charts = await apiCall({ action: 'chart', platform: 'netease' });
        if (Array.isArray(charts) && charts.length > 0) {
            const hot = charts[0];
            const detail = await apiCall({ action: 'chart', platform: 'netease', listId: hot.id });
            if (detail.tracks) { window._chartSongs_netease = detail.tracks.slice(0, 20); renderChartSongs(container, window._chartSongs_netease); }
        } else {
            container.innerHTML = '<div class="chart-loading" style="color:#71717a;">加载失败</div>';
        }
    } catch { container.innerHTML = '<div class="chart-loading" style="color:#71717a;">加载失败</div>'; }
}

async function loadQQCharts() {
    const container = $('#chartSongsQQ');
    try {
        const charts = await apiCall({ action: 'chart', platform: 'qq' });
        if (Array.isArray(charts) && charts.length > 0) {
            const top = charts[0];
            const detail = await apiCall({ action: 'chart', platform: 'qq', listId: top.id });
            if (detail.tracks) { window._chartSongs_qq = detail.tracks.slice(0, 20); renderChartSongs(container, window._chartSongs_qq); }
        } else {
            container.innerHTML = '<div class="chart-loading" style="color:#71717a;">加载失败</div>';
        }
    } catch { container.innerHTML = '<div class="chart-loading" style="color:#71717a;">加载失败</div>'; }
}

function renderChartSongs(container, songs) {
    container.innerHTML = songs.slice(0, 20).map((song, i) => `
        <div class="chart-song-item" data-song='${esc(JSON.stringify(song))}'>
            <span class="song-index">${i + 1}</span>
            <img class="song-cover" src="${song.img_url || song.cover_url || ''}" onerror="this.style.display='none'" loading="lazy">
            <div class="song-info">
                <div class="song-title">${esc(song.title)}</div>
                <div class="song-artist">${esc(song.artist)}</div>
            </div>
            <span class="song-duration">${format_duration(song.duration || 0)}</span>
            <div class="song-actions">
                <button class="btn-icon" data-action="add"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg></button>
            </div>
        </div>`).join('');

    container.querySelectorAll('.chart-song-item').forEach(item => {
        item.addEventListener('dblclick', () => { addAndPlay(JSON.parse(item.dataset.song)); });
        item.addEventListener('click', (e) => {
            if (e.target.closest('[data-action="add"]')) { e.stopPropagation(); addToPlaylist(JSON.parse(item.dataset.song)); toast('已添加', 'success'); }
        });
    });
}

// ─── Platform-specific search result parsers (for proxy responses) ───
function parseNeteaseRaw(data) {
    const s = data.result?.songs || [];
    return s.map(x => ({
        id: 'netrack_' + x.id, title: x.name, artist: x.artists?.[0]?.name || '', artist_id: 'neartist_' + (x.artists?.[0]?.id || ''),
        album: x.album?.name || '', album_id: 'nealbum_' + (x.album?.id || ''), source: 'netease',
        source_url: 'https://music.163.com/#/song?id=' + x.id, img_url: x.album?.picUrl || '',
        duration: Math.floor((x.duration || 0) / 1000), disable: x.fee === 4 || x.fee === 1,
    }));
}

function parseKuwoRaw(data) {
    const s = data.abslist || [];
    return s.map(x => ({
        id: 'kwtrack_' + x.DC_TARGETID, title: x.NAME, artist: x.ARTIST, artist_id: 'kwartist_' + x.ARTISTID,
        album: x.ALBUM, album_id: 'kwalbum_' + x.ALBUMID, source: 'kuwo',
        source_url: 'https://www.kuwo.cn/play_detail/' + x.DC_TARGETID,
        img_url: 'https://img2.kuwo.cn/star/albumcover/' + (x.web_albumpic_short || ''),
        duration: parseInt(x.DURATION || 0), lyric_url: x.DC_TARGETID,
    }));
}

// ─── Search ───
async function search() {
    const query = searchInput.value.trim();
    if (!query) { showCharts(true); return; }

    showLoading(true);
    showCharts(false);
    resultTitle.textContent = '搜索: "' + query + '" · ' + platformNames[currentPlatform];
    songList.innerHTML = '';

    try {
        const data = await apiCall({ action: 'search', platform: currentPlatform, keyword: query, page: '1' });

        // Handle proxy errors (platform returned HTML)
        if (data._proxy_error) {
            songList.innerHTML = '<div class="empty-state"><p>' + platformNames[currentPlatform] + ' 接口暂不可用</p><p class="sub">平台API返回异常 (HTTP ' + data.status + ')，试试其他平台</p></div>';
            return;
        }

        // Handle worker errors
        if (data.error) {
            songList.innerHTML = '<div class="empty-state"><p>搜索失败</p><p class="sub">' + data.error + '</p></div>';
            return;
        }

        let songs = data.result || [];

        // Handle raw proxy responses for netease/kuwo
        if (!songs.length && data.result && (currentPlatform === 'netease' || currentPlatform === 'kuwo')) {
            songs = currentPlatform === 'netease' ? parseNeteaseRaw(data) : parseKuwoRaw(data);
        }

        resultCount.textContent = songs.length + ' 首';
        renderSongs(songs);
    } catch (err) {
        songList.innerHTML = '<div class="empty-state"><p>搜索失败</p><p class="sub">' + err.message + '</p></div>';
    } finally {
        showLoading(false);
    }
}

function renderSongs(songs) {
    if (!songs.length) { songList.innerHTML = '<div class="empty-state"><p>没有找到结果</p></div>'; return; }
    songList.innerHTML = songs.map((song, i) => `
        <div class="song-item" data-song='${esc(JSON.stringify(song))}'>
            <span class="song-index">${i + 1}</span>
            <img class="song-cover" src="${song.img_url || song.cover_url || ''}" onerror="this.style.display='none'" loading="lazy">
            <div class="song-info">
                <div class="song-title">${esc(song.title)}</div>
                <div class="song-artist">${esc(song.artist)}${song.disable ? ' <span style="color:#ef4444;">[VIP]</span>' : ''}</div>
            </div>
            <span class="song-duration">${format_duration(song.duration || 0)}</span>
            <div class="song-actions">
                <button class="btn-icon" data-action="add"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg></button>
            </div>
        </div>`).join('');

    songList.querySelectorAll('.song-item').forEach(item => {
        item.addEventListener('dblclick', () => addAndPlay(JSON.parse(item.dataset.song)));
        item.addEventListener('click', (e) => {
            if (e.target.closest('[data-action="add"]')) { e.stopPropagation(); addToPlaylist(JSON.parse(item.dataset.song)); toast('已添加', 'success'); e.target.closest('[data-action="add"]').classList.add('added'); }
        });
    });
}

function showCharts(show) {
    chartsContainer.style.display = show ? 'block' : 'none';
    songList.style.display = show ? 'none' : 'block';
    if (show) { resultTitle.textContent = '热门推荐'; resultCount.textContent = ''; }
}

// ─── NetEase import ───
function openImportModal() { $('#importModal').style.display = 'flex'; $('#playlistIdInput').focus(); }
function closeImportModal() { $('#importModal').style.display = 'none'; $('#playlistIdInput').value = ''; $('#importLoading').style.display = 'none'; }

async function importPlaylist() {
    const input = $('#playlistIdInput').value.trim();
    if (!input) return;
    let playlistId = input;
    const m = input.match(/playlist\?id=(\d+)/) || input.match(/playlist\/(\d+)/);
    if (m) playlistId = m[1];

    $('#importLoading').style.display = 'flex';
    try {
        const data = await apiCall({ action: 'playlist', platform: 'netease', listId: 'neplaylist_' + playlistId });
        if (!data.tracks || !data.tracks.length) { toast('歌单为空', 'error'); return; }
        playlist.clear();
        data.tracks.forEach(s => playlist.add_song(JSON.stringify(s)));
        renderPlaylist();
        closeImportModal();
        toast(`导入 ${data.tracks.length} 首`, 'success');
        playSong(0);
    } catch { toast('导入失败', 'error'); } finally { $('#importLoading').style.display = 'none'; }
}

// ─── Playlist ───
function addToPlaylist(song) { playlist.add_song(JSON.stringify(song)); renderPlaylist(); }
function addAndPlay(song) { addToPlaylist(song); playSong(playlist.size() - 1); }

function removeFromPlaylist(index) {
    playlist.remove_song(index);
    if (currentPlaylistIndex === index) { currentPlaylistIndex = -1; stopPlayback(); }
    else if (currentPlaylistIndex > index) currentPlaylistIndex--;
    renderPlaylist();
}

function clearPlaylist() { playlist.clear(); currentPlaylistIndex = -1; stopPlayback(); renderPlaylist(); }

function renderPlaylist() {
    const songs = JSON.parse(playlist.get_all_songs());
    playlistCount.textContent = playlist.size();
    if (!songs.length) { playlistSongs.innerHTML = '<div class="empty-state small"><p>播放列表为空</p></div>'; return; }
    playlistSongs.innerHTML = songs.map((s, i) => `
        <div class="playlist-item ${i === currentPlaylistIndex ? 'active' : ''}" data-index="${i}">
            <img class="song-cover" src="${s.img_url || s.cover_url || ''}" onerror="this.style.display='none'" loading="lazy">
            <div class="song-info">
                <div class="song-title">${esc(s.title)}</div>
                <div class="song-artist">${esc(s.artist)} · ${platformNames[s.source] || s.platform || ''}</div>
            </div>
            <button class="btn-remove" data-action="remove"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
        </div>`).join('');

    playlistSongs.querySelectorAll('.playlist-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.closest('[data-action="remove"]')) { e.stopPropagation(); removeFromPlaylist(parseInt(item.dataset.index)); return; }
            playSong(parseInt(item.dataset.index));
        });
    });
}

function playlistSongIndex(song) {
    return JSON.parse(playlist.get_all_songs()).findIndex(s => s.id === song.id && (s.source || s.platform) === (song.source || song.platform));
}

// ─── Playback ───
async function playSong(index) {
    if (index < 0 || index >= playlist.size()) return;
    playlist.set_current_index(index);
    currentPlaylistIndex = index;
    const song = JSON.parse(playlist.get_current_song());
    const platform = song.source || song.platform;

    playerTitle.textContent = song.title;
    playerArtist.textContent = song.artist + ' · ' + (platformNames[platform] || platform);
    playerCover.src = song.img_url || song.cover_url || '';
    platformBadge.textContent = platformNames[platform] || platform;
    platformBadge.style.color = platformColors[platform] || '';

    // Get play URL from backend
    try {
        const extra = song.song_id ? JSON.stringify({ content_id: song.content_id, quality: song.quality }) : '';
        const data = await apiCall({ action: 'bootstrap', platform, trackId: song.id, extra });
        if (data.url) {
            audio.src = data.url;
            audio.play().catch(() => toast('播放失败', 'error'));
            setPlayState(true);
        } else {
            toast('该歌曲需要VIP或暂不可用', 'error');
        }
    } catch (err) {
        toast('获取播放地址失败', 'error');
    }
    renderPlaylist();
}

function togglePlay() {
    if (!audio.src || audio.src === location.href) return;
    audio.paused ? audio.play().then(() => setPlayState(true)) : (audio.pause(), setPlayState(false));
}

function setPlayState(p) { $('#playIcon').innerHTML = p ? '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>' : '<path d="M8 5v14l11-7z"/>'; }

function playPrev() { if (playlist.size()) playSong(currentPlaylistIndex <= 0 ? playlist.size() - 1 : currentPlaylistIndex - 1); }
function playNext() { if (playlist.size()) playSong((currentPlaylistIndex + 1) % playlist.size()); }

function stopPlayback() {
    audio.pause(); audio.src = '';
    playerTitle.textContent = '未在播放'; playerArtist.textContent = '选择一首歌曲开始播放';
    playerCover.src = ''; platformBadge.textContent = '';
    progressFill.style.width = '0%'; currentTimeEl.textContent = '00:00'; durationEl.textContent = '00:00';
    setPlayState(false);
}

function onSongEnd() { playNext(); }
function onAudioError() { toast('播放失败', 'error'); }

// ─── Progress & Volume ───
function updateProgress() { if (audio.duration) { progressFill.style.width = (audio.currentTime / audio.duration) * 100 + '%'; currentTimeEl.textContent = fmt(audio.currentTime); } }
function updateDuration() { durationEl.textContent = fmt(audio.duration); }
function seek(e) { audio.currentTime = ((e.clientX - progressBar.getBoundingClientRect().left) / progressBar.offsetWidth) * audio.duration; }
function setVolume(e) { const v = Math.max(0, Math.min(1, (e.clientX - volumeBar.getBoundingClientRect().left) / volumeBar.offsetWidth)); audio.volume = v; volumeFill.style.width = (v * 100) + '%'; }
function toggleMute() {
    audio.muted = !audio.muted;
    $('#volumeIcon').innerHTML = audio.muted ? '<path d="M11 5L6 9H2v6h4l5 5V5zM23 9l-6 6M17 9l6 6"/>' : '<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>';
}

// ─── Utils ───
function showLoading(s) { loading.style.display = s ? 'flex' : 'none'; }
function fmt(s) { if (isNaN(s)) return '00:00'; const m = Math.floor(s / 60); return m.toString().padStart(2, '0') + ':' + Math.floor(s % 60).toString().padStart(2, '0'); }
function esc(str) { return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function toast(msg, type = 'info') {
    let c = $('.toast-container'); if (!c) { c = document.createElement('div'); c.className = 'toast-container'; document.body.appendChild(c); }
    const el = document.createElement('div'); el.className = `toast ${type}`; el.textContent = msg; c.appendChild(el);
    setTimeout(() => el.remove(), 2500);
}

bootstrap().catch(console.error);
