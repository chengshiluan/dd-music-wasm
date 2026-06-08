import init, { Playlist, get_platforms, parse_netease_search, parse_qq_search, parse_kugou_search, parse_kuwo_search, parse_bilibili_search, parse_migu_search, build_netease_song_url, build_netease_lyric_url, format_duration } from '../pkg/dd_music_wasm.js';

// ─── State ───
let playlist;
let currentPlatform = 'netease';
let currentPlaylistIndex = -1;
let audioUrls = {}; // songId -> audioUrl (resolved)

// ─── DOM refs ───
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const audio = $('#audio');
const searchInput = $('#searchInput');
const searchBtn = $('#searchBtn');
const songList = $('#songList');
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
const platformTabs = $('#platformTabs');

// ─── Audio proxy config ───
// When deployed on Cloudflare, this is /api/proxy
const PROXY_URL = '/api/proxy?url=';

// ─── Platform parsers ───
const parsers = {
    netease: parse_netease_search,
    qq: parse_qq_search,
    kugou: parse_kugou_search,
    kuwo: parse_kuwo_search,
    bilibili: parse_bilibili_search,
    migu: parse_migu_search,
};

const platformNames = {
    netease: '网易云',
    qq: 'QQ音乐',
    kugou: '酷狗',
    kuwo: '酷我',
    bilibili: 'B站',
    migu: '咪咕',
};

const platformSearchParams = {
    netease: (q) => `s=${encodeURIComponent(q)}&type=1&limit=20`,
    qq: (q) => `w=${encodeURIComponent(q)}&format=json&n=20`,
    kugou: (q) => `keyword=${encodeURIComponent(q)}&page=1&pagesize=20`,
    kuwo: (q) => `key=${encodeURIComponent(q)}&pn=1&rn=20`,
    bilibili: (q) => `keyword=${encodeURIComponent(q)}&search_type=video&page=1`,
    migu: (q) => `keyword=${encodeURIComponent(q)}&page=1&rows=20`,
};

const searchUrls = {
    netease: 'https://music.163.com/api/search/get',
    qq: 'https://c.y.qq.com/soso/fcgi-bin/client_search_cp',
    kugou: 'https://songsearch.kugou.com/song_search_v2',
    kuwo: 'https://www.kuwo.cn/api/www/search/searchMusicBykeyWord',
    bilibili: 'https://api.bilibili.com/x/web-interface/search/type',
    migu: 'https://m.music.migu.cn/migu/remoting/scr_search_tag',
};

// ─── Init ───
async function bootstrap() {
    await init();
    playlist = new Playlist();

    // Platform tabs
    platformTabs.addEventListener('click', (e) => {
        const tab = e.target.closest('.platform-tab');
        if (!tab) return;
        currentPlatform = tab.dataset.platform;
        $$('.platform-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        // Re-search if there's input
        if (searchInput.value.trim()) {
            search();
        }
    });

    // Search
    searchBtn.addEventListener('click', search);
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') search();
    });

    // Player controls
    $('#btnPlay').addEventListener('click', togglePlay);
    $('#btnPrev').addEventListener('click', playPrev);
    $('#btnNext').addEventListener('click', playNext);
    $('#clearPlaylist').addEventListener('click', clearPlaylist);

    // Progress bar
    progressBar.addEventListener('click', seek);

    // Volume bar
    volumeBar.addEventListener('click', setVolume);
    $('#btnVolume').addEventListener('click', toggleMute);

    // Audio events
    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', onSongEnd);
    audio.addEventListener('error', onAudioError);

    renderPlaylist();
}

// ─── Search ───
async function search() {
    const query = searchInput.value.trim();
    if (!query) return;

    showLoading(true);
    resultTitle.textContent = `搜索: "${query}"`;
    songList.innerHTML = '';

    try {
        const url = searchUrls[currentPlatform];
        const params = platformSearchParams[currentPlatform](query);
        const fullUrl = `${url}?${params}`;
        const proxyUrl = PROXY_URL + encodeURIComponent(fullUrl);

        const headers = {};
        if (currentPlatform === 'kuwo') {
            headers['Referer'] = 'https://www.kuwo.cn/';
            headers['csrf'] = '1';
        }
        if (currentPlatform === 'bilibili') {
            headers['Referer'] = 'https://www.bilibili.com/';
        }
        if (currentPlatform === 'migu') {
            headers['Referer'] = 'https://m.music.migu.cn/';
        }

        const resp = await fetch(proxyUrl, { headers });
        const data = await resp.text();
        const songsJson = parsers[currentPlatform](data);
        const songs = JSON.parse(songsJson);

        resultCount.textContent = `${songs.length} 首`;
        renderSongs(songs);
    } catch (err) {
        console.error('Search error:', err);
        songList.innerHTML = `<div class="empty-state"><p>搜索失败</p><p class="sub">${err.message}</p></div>`;
    } finally {
        showLoading(false);
    }
}

// ─── Render songs ───
function renderSongs(songs) {
    songList.innerHTML = songs.map((song, i) => {
        const inPlaylist = playlistSongIndex(song);
        return `
        <div class="song-item" data-index="${i}" data-song='${escapeHtml(JSON.stringify(song))}'>
            <span class="song-index">${i + 1}</span>
            <img class="song-cover" src="${song.cover_url || ''}" onerror="this.style.display='none'" loading="lazy">
            <div class="song-info">
                <div class="song-title">${escapeHtml(song.title)}</div>
                <div class="song-artist">${escapeHtml(song.artist)}</div>
            </div>
            <span class="song-duration">${format_duration(song.duration)}</span>
            <div class="song-actions">
                <button class="btn-icon ${inPlaylist >= 0 ? 'added' : ''}" data-action="add" title="添加到播放列表">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 5v14M5 12h14"/>
                    </svg>
                </button>
            </div>
        </div>`;
    }).join('');

    // Click handlers
    songList.querySelectorAll('.song-item').forEach(item => {
        item.addEventListener('dblclick', () => {
            const song = getSongData(item);
            addToPlaylist(song);
            playSong(playlist.size() - 1);
        });
        item.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action="add"]');
            if (btn) {
                e.stopPropagation();
                const song = getSongData(item);
                addToPlaylist(song);
                btn.classList.add('added');
                toast('已添加到播放列表', 'success');
            }
        });
    });
}

function getSongData(item) {
    return JSON.parse(item.querySelector('[data-song]')?.textContent || item.dataset.song);
}

function playlistSongIndex(song) {
    const allSongs = JSON.parse(playlist.get_all_songs());
    return allSongs.findIndex(s => s.id === song.id && s.platform === song.platform);
}

// ─── Playlist ───
function addToPlaylist(song) {
    playlist.add_song(JSON.stringify(song));
    renderPlaylist();
}

function removeFromPlaylist(index) {
    playlist.remove_song(index);
    if (currentPlaylistIndex === index) {
        currentPlaylistIndex = -1;
        stopPlayback();
    } else if (currentPlaylistIndex > index) {
        currentPlaylistIndex--;
    }
    renderPlaylist();
}

function clearPlaylist() {
    playlist.clear();
    currentPlaylistIndex = -1;
    stopPlayback();
    renderPlaylist();
}

function renderPlaylist() {
    const allSongs = JSON.parse(playlist.get_all_songs());
    playlistCount.textContent = playlist.size();

    if (allSongs.length === 0) {
        playlistSongs.innerHTML = `<div class="empty-state small"><p>播放列表为空</p><p class="sub">搜索歌曲，点击 + 添加</p></div>`;
        return;
    }

    playlistSongs.innerHTML = allSongs.map((song, i) => `
        <div class="playlist-item ${i === currentPlaylistIndex ? 'active' : ''}" data-index="${i}">
            <img class="song-cover" src="${song.cover_url || ''}" onerror="this.style.display='none'" loading="lazy">
            <div class="song-info">
                <div class="song-title">${escapeHtml(song.title)}</div>
                <div class="song-artist">${escapeHtml(song.artist)}</div>
            </div>
            <button class="btn-remove" data-action="remove">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
            </button>
        </div>
    `).join('');

    playlistSongs.querySelectorAll('.playlist-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.closest('[data-action="remove"]')) {
                e.stopPropagation();
                removeFromPlaylist(parseInt(item.dataset.index));
                return;
            }
            const index = parseInt(item.dataset.index);
            playSong(index);
        });
    });
}

// ─── Playback ───
async function playSong(index) {
    if (index < 0 || index >= playlist.size()) return;

    playlist.set_current_index(index);
    currentPlaylistIndex = index;
    const songJson = playlist.get_current_song();
    const song = JSON.parse(songJson);

    playerTitle.textContent = song.title;
    playerArtist.textContent = `${song.artist} · ${platformNames[song.platform] || song.platform}`;
    playerCover.src = song.cover_url || '';
    platformBadge.textContent = platformNames[song.platform] || song.platform;

    // Cache key for audio URL
    const cacheKey = `${song.platform}:${song.id}`;

    if (!audioUrls[cacheKey]) {
        audioUrls[cacheKey] = await resolveAudioUrl(song);
    }

    audio.src = audioUrls[cacheKey];
    audio.play().catch(e => {
        console.error('Play failed:', e);
        toast('播放失败，尝试切换平台', 'error');
    });

    setPlayState(true);
    renderPlaylist();
}

async function resolveAudioUrl(song) {
    switch (song.platform) {
        case 'netease':
            return build_netease_song_url(song.id);
        case 'qq':
            return PROXY_URL + encodeURIComponent(
                `https://u.y.qq.com/cgi-bin/musicu.fcg?data=${encodeURIComponent(JSON.stringify({
                    req_0: { module: "vkey.GetVkeyServer", method: "CgiGetVkey", param: { guid: "0", songmid: [song.id], uin: "0" } }
                }))}`
            );
        default:
            return '';
    }
}

function togglePlay() {
    if (!audio.src) return;
    if (audio.paused) {
        audio.play();
        setPlayState(true);
    } else {
        audio.pause();
        setPlayState(false);
    }
}

function setPlayState(playing) {
    const icon = $('#playIcon');
    if (playing) {
        icon.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
    } else {
        icon.innerHTML = '<path d="M8 5v14l11-7z"/>';
    }
}

function playPrev() {
    if (playlist.size() === 0) return;
    const idx = currentPlaylistIndex <= 0 ? playlist.size() - 1 : currentPlaylistIndex - 1;
    playSong(idx);
}

function playNext() {
    if (playlist.size() === 0) return;
    const idx = (currentPlaylistIndex + 1) % playlist.size();
    playSong(idx);
}

function stopPlayback() {
    audio.pause();
    audio.src = '';
    playerTitle.textContent = '未在播放';
    playerArtist.textContent = '选择一首歌曲开始播放';
    playerCover.src = '';
    platformBadge.textContent = '';
    progressFill.style.width = '0%';
    currentTimeEl.textContent = '00:00';
    durationEl.textContent = '00:00';
    setPlayState(false);
}

function onSongEnd() {
    playNext();
}

function onAudioError() {
    toast('播放失败，请尝试其他平台', 'error');
}

// ─── Progress ───
function updateProgress() {
    if (audio.duration) {
        const pct = (audio.currentTime / audio.duration) * 100;
        progressFill.style.width = pct + '%';
        currentTimeEl.textContent = formatTime(audio.currentTime);
    }
}

function updateDuration() {
    durationEl.textContent = formatTime(audio.duration);
}

function seek(e) {
    const rect = progressBar.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audio.currentTime = pct * audio.duration;
}

function setVolume(e) {
    const rect = volumeBar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.volume = pct;
    volumeFill.style.width = (pct * 100) + '%';
}

function toggleMute() {
    audio.muted = !audio.muted;
    const icon = $('#volumeIcon');
    if (audio.muted) {
        icon.innerHTML = '<path d="M11 5L6 9H2v6h4l5 5V5zM23 9l-6 6M17 9l6 6"/>';
    } else {
        icon.innerHTML = '<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>';
    }
}

// ─── Utils ───
function showLoading(show) {
    loading.style.display = show ? 'flex' : 'none';
}

function formatTime(seconds) {
    if (isNaN(seconds)) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function toast(msg, type = 'info') {
    let container = $('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => el.remove(), 2500);
}

// ─── Boot ───
bootstrap().catch(console.error);
