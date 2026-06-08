import init, { Playlist, get_platforms, parse_netease_search, parse_qq_search, parse_kugou_search, parse_kuwo_search, parse_bilibili_search, parse_migu_search, parse_netease_chart, parse_qq_chart, parse_bilibili_popular, parse_kugou_chart, parse_netease_playlist, build_netease_song_url, format_duration } from '../pkg/dd_music_wasm.js';

// ─── State ───
let playlist;
let currentPlatform = 'bilibili';
let allChartSongs = {};
let currentPlaylistIndex = -1;

const PROXY_URL = '/api/proxy?url=';
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

// ─── Platform config ───
const parsers = {
    netease: parse_netease_search,
    qq: parse_qq_search,
    kugou: parse_kugou_search,
    kuwo: parse_kuwo_search,
    bilibili: parse_bilibili_search,
    migu: parse_migu_search,
};

const chartParsers = {
    netease: parse_netease_chart,
    qq: parse_qq_chart,
    bilibili: parse_bilibili_popular,
    kugou: parse_kugou_chart,
};

const platformNames = {
    netease: '网易云', qq: 'QQ音乐', kugou: '酷狗',
    kuwo: '酷我', bilibili: 'B站', migu: '咪咕',
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

// Chart API endpoints
const chartUrls = {
    netease: 'https://music.163.com/api/playlist/detail?id=3778678',
    qq: 'https://c.y.qq.com/v8/fcg-bin/fcg_myqq_toplist.fcg?format=json&type=toplist&topid=26',
    bilibili: 'https://api.bilibili.com/x/web-interface/popular?ps=20',
    kugou: 'https://www.kugou.com/yy/rank/home/1-8888.html?from=rank',
};

// ─── Init ───
async function bootstrap() {
    await init();
    playlist = new Playlist();

    // Platform tabs
    $('#platformTabs').addEventListener('click', (e) => {
        const tab = e.target.closest('.platform-tab');
        if (!tab) return;
        currentPlatform = tab.dataset.platform;
        $$('.platform-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        if (searchInput.value.trim()) {
            search();
        }
    });

    // Search
    searchBtn.addEventListener('click', () => search());
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') search();
    });

    // Player controls
    $('#btnPlay').addEventListener('click', togglePlay);
    $('#btnPrev').addEventListener('click', playPrev);
    $('#btnNext').addEventListener('click', playNext);
    $('#clearPlaylist').addEventListener('click', clearPlaylist);

    // Progress & volume
    progressBar.addEventListener('click', seek);
    volumeBar.addEventListener('click', setVolume);
    $('#btnVolume').addEventListener('click', toggleMute);

    // Audio events
    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', onSongEnd);
    audio.addEventListener('error', onAudioError);

    // NetEase import modal
    $('#neteaseImportBtn').addEventListener('click', openImportModal);
    $('#closeImportModal').addEventListener('click', closeImportModal);
    $('#importModal').addEventListener('click', (e) => {
        if (e.target === $('#importModal')) closeImportModal();
    });
    $('#importPlaylistBtn').addEventListener('click', importPlaylist);

    // Chart "play all" buttons
    chartsContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.chart-play-all');
        if (!btn) return;
        const chart = btn.dataset.chart;
        if (allChartSongs[chart]) {
            playlist.clear();
            allChartSongs[chart].forEach(s => playlist.add_song(JSON.stringify(s)));
            renderPlaylist();
            playSong(0);
            toast(`已添加 ${allChartSongs[chart].length} 首歌曲`, 'success');
        }
    });

    renderPlaylist();
    loadCharts();
}

// ─── Chart loading ───
async function loadCharts() {
    const charts = ['bilibili', 'netease', 'qq'];
    for (const platform of charts) {
        loadChart(platform);
    }
}

async function loadChart(platform) {
    const container = $(`#chartSongs${platform.charAt(0).toUpperCase() + platform.slice(1)}`);
    if (!container) return;
    try {
        const url = chartUrls[platform];
        const proxyUrl = PROXY_URL + encodeURIComponent(url);
        const headers = {};
        if (platform === 'netease') headers['Referer'] = 'https://music.163.com/';
        if (platform === 'bilibili') headers['Referer'] = 'https://www.bilibili.com/';

        const resp = await fetch(proxyUrl, { headers });
        const data = await resp.text();
        const songsJson = chartParsers[platform](data);
        const songs = JSON.parse(songsJson);
        allChartSongs[platform] = songs;

        container.innerHTML = songs.slice(0, 20).map((song, i) => `
            <div class="chart-song-item" data-song='${escapeHtml(JSON.stringify(song))}'>
                <span class="song-index">${i + 1}</span>
                <img class="song-cover" src="${song.cover_url || ''}" onerror="this.style.display='none'" loading="lazy">
                <div class="song-info">
                    <div class="song-title">${escapeHtml(song.title)}</div>
                    <div class="song-artist">${escapeHtml(song.artist)}</div>
                </div>
                <span class="song-duration">${format_duration(song.duration)}</span>
                <div class="song-actions">
                    <button class="btn-icon" data-action="add" title="添加到播放列表">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
                    </button>
                </div>
            </div>
        `).join('');

        // Click handlers
        container.querySelectorAll('.chart-song-item').forEach(item => {
            item.addEventListener('dblclick', () => {
                const song = JSON.parse(item.dataset.song);
                addToPlaylist(song);
                playSong(playlist.size() - 1);
            });
            item.addEventListener('click', (e) => {
                if (e.target.closest('[data-action="add"]')) {
                    e.stopPropagation();
                    const song = JSON.parse(item.dataset.song);
                    addToPlaylist(song);
                    toast('已添加到播放列表', 'success');
                }
            });
        });
    } catch (err) {
        console.error(`Chart ${platform} error:`, err);
        container.innerHTML = '<div class="chart-loading" style="color:#71717a;">加载失败</div>';
    }
}

// ─── Search (Bilibili first) ───
async function search() {
    const query = searchInput.value.trim();
    if (!query) {
        showCharts(true);
        return;
    }

    showLoading(true);
    showCharts(false);
    resultTitle.textContent = `搜索: "${query}"`;
    songList.innerHTML = '';

    // Search current platform first, then fetch all in background
    try {
        const songs = await searchPlatform(currentPlatform, query);
        resultCount.textContent = `${songs.length} 首`;
        renderSongs(songs);
    } catch (err) {
        console.error('Search error:', err);
        songList.innerHTML = `<div class="empty-state"><p>搜索失败</p><p class="sub">${err.message}</p></div>`;
    } finally {
        showLoading(false);
    }
}

async function searchPlatform(platform, query) {
    const url = searchUrls[platform];
    const params = platformSearchParams[platform](query);
    const fullUrl = `${url}?${params}`;
    const proxyUrl = PROXY_URL + encodeURIComponent(fullUrl);

    const headers = {};
    if (platform === 'kuwo') { headers['Referer'] = 'https://www.kuwo.cn/'; headers['csrf'] = '1'; }
    if (platform === 'bilibili') headers['Referer'] = 'https://www.bilibili.com/';
    if (platform === 'migu') headers['Referer'] = 'https://m.music.migu.cn/';
    if (platform === 'netease') headers['Referer'] = 'https://music.163.com/';

    const resp = await fetch(proxyUrl, { headers });
    const data = await resp.text();
    const songsJson = parsers[platform](data);
    return JSON.parse(songsJson);
}

// ─── Render search results ───
function renderSongs(songs) {
    if (songs.length === 0) {
        songList.innerHTML = '<div class="empty-state"><p>没有找到结果</p><p class="sub">试试其他平台或关键词</p></div>';
        return;
    }
    songList.innerHTML = songs.map((song, i) => {
        const inPlaylist = playlistSongIndex(song);
        return `
        <div class="song-item" data-song='${escapeHtml(JSON.stringify(song))}'>
            <span class="song-index">${i + 1}</span>
            <img class="song-cover" src="${song.cover_url || ''}" onerror="this.style.display='none'" loading="lazy">
            <div class="song-info">
                <div class="song-title">${escapeHtml(song.title)}</div>
                <div class="song-artist">${escapeHtml(song.artist)}</div>
            </div>
            <span class="song-duration">${format_duration(song.duration)}</span>
            <div class="song-actions">
                <button class="btn-icon ${inPlaylist >= 0 ? 'added' : ''}" data-action="add" title="添加到播放列表">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
                </button>
            </div>
        </div>`;
    }).join('');

    songList.querySelectorAll('.song-item').forEach(item => {
        item.addEventListener('dblclick', () => {
            const song = JSON.parse(item.dataset.song);
            addToPlaylist(song);
            playSong(playlist.size() - 1);
        });
        item.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action="add"]');
            if (btn) {
                e.stopPropagation();
                const song = JSON.parse(item.dataset.song);
                addToPlaylist(song);
                btn.classList.add('added');
                toast('已添加到播放列表', 'success');
            }
        });
    });
}

function showCharts(show) {
    chartsContainer.style.display = show ? '' : 'none';
    songList.style.display = show ? 'none' : '';
    if (show) {
        resultTitle.textContent = '热门推荐';
        resultCount.textContent = '';
    }
}

// ─── NetEase playlist import ───
function openImportModal() {
    $('#importModal').style.display = 'flex';
    $('#playlistIdInput').focus();
}

function closeImportModal() {
    $('#importModal').style.display = 'none';
    $('#playlistIdInput').value = '';
    $('#importLoading').style.display = 'none';
}

async function importPlaylist() {
    const input = $('#playlistIdInput').value.trim();
    if (!input) return;

    let playlistId = input;
    // Extract ID from URL if full URL is pasted
    const urlMatch = input.match(/playlist\?id=(\d+)/) || input.match(/playlist\/(\d+)/);
    if (urlMatch) playlistId = urlMatch[1];

    const loadingEl = $('#importLoading');
    loadingEl.style.display = 'flex';

    try {
        const url = `https://music.163.com/api/playlist/detail?id=${playlistId}`;
        const proxyUrl = PROXY_URL + encodeURIComponent(url);
        const resp = await fetch(proxyUrl, { headers: { 'Referer': 'https://music.163.com/' } });
        const data = await resp.text();
        const songsJson = parse_netease_playlist(data);
        const songs = JSON.parse(songsJson);

        if (songs.length === 0) {
            toast('歌单为空或无法访问', 'error');
            return;
        }

        playlist.clear();
        songs.forEach(s => playlist.add_song(JSON.stringify(s)));
        renderPlaylist();
        closeImportModal();
        toast(`成功导入 ${songs.length} 首歌曲`, 'success');
        playSong(0);
    } catch (err) {
        console.error('Import error:', err);
        toast('导入失败，请检查歌单ID', 'error');
    } finally {
        loadingEl.style.display = 'none';
    }
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
        playlistSongs.innerHTML = '<div class="empty-state small"><p>播放列表为空</p><p class="sub">搜索歌曲或导入歌单</p></div>';
        return;
    }

    playlistSongs.innerHTML = allSongs.map((song, i) => `
        <div class="playlist-item ${i === currentPlaylistIndex ? 'active' : ''}" data-index="${i}">
            <img class="song-cover" src="${song.cover_url || ''}" onerror="this.style.display='none'" loading="lazy">
            <div class="song-info">
                <div class="song-title">${escapeHtml(song.title)}</div>
                <div class="song-artist">${escapeHtml(song.artist)} · ${platformNames[song.platform]}</div>
            </div>
            <button class="btn-remove" data-action="remove">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
        </div>`).join('');

    playlistSongs.querySelectorAll('.playlist-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.closest('[data-action="remove"]')) {
                e.stopPropagation();
                removeFromPlaylist(parseInt(item.dataset.index));
                return;
            }
            playSong(parseInt(item.dataset.index));
        });
    });
}

function playlistSongIndex(song) {
    const allSongs = JSON.parse(playlist.get_all_songs());
    return allSongs.findIndex(s => s.id === song.id && s.platform === song.platform);
}

// ─── Playback ───
async function playSong(index) {
    if (index < 0 || index >= playlist.size()) return;

    playlist.set_current_index(index);
    currentPlaylistIndex = index;
    const song = JSON.parse(playlist.get_current_song());

    playerTitle.textContent = song.title;
    playerArtist.textContent = `${song.artist} · ${platformNames[song.platform] || song.platform}`;
    playerCover.src = song.cover_url || '';
    platformBadge.textContent = platformNames[song.platform] || '';

    if (song.platform === 'netease') {
        audio.src = build_netease_song_url(song.id);
    } else {
        audio.src = '';
        toast(`${platformNames[song.platform]} 歌曲需要平台Cookie支持`, 'error');
    }

    audio.play().catch(() => {
        toast('播放失败，请尝试网易云歌曲或切换平台', 'error');
    });

    setPlayState(true);
    renderPlaylist();
}

function togglePlay() {
    if (!audio.src || audio.src === window.location.href) return;
    if (audio.paused) { audio.play(); setPlayState(true); }
    else { audio.pause(); setPlayState(false); }
}

function setPlayState(playing) {
    const icon = $('#playIcon');
    icon.innerHTML = playing
        ? '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>'
        : '<path d="M8 5v14l11-7z"/>';
}

function playPrev() {
    if (playlist.size() === 0) return;
    playSong(currentPlaylistIndex <= 0 ? playlist.size() - 1 : currentPlaylistIndex - 1);
}

function playNext() {
    if (playlist.size() === 0) return;
    playSong((currentPlaylistIndex + 1) % playlist.size());
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

function onSongEnd() { playNext(); }
function onAudioError() { toast('播放失败，请尝试其他平台', 'error'); }

// ─── Progress & volume ───
function updateProgress() {
    if (audio.duration) {
        progressFill.style.width = (audio.currentTime / audio.duration) * 100 + '%';
        currentTimeEl.textContent = formatTime(audio.currentTime);
    }
}
function updateDuration() { durationEl.textContent = formatTime(audio.duration); }
function seek(e) {
    const pct = (e.clientX - progressBar.getBoundingClientRect().left) / progressBar.offsetWidth;
    audio.currentTime = pct * audio.duration;
}
function setVolume(e) {
    const pct = Math.max(0, Math.min(1, (e.clientX - volumeBar.getBoundingClientRect().left) / volumeBar.offsetWidth));
    audio.volume = pct;
    volumeFill.style.width = (pct * 100) + '%';
}
function toggleMute() {
    audio.muted = !audio.muted;
    $('#volumeIcon').innerHTML = audio.muted
        ? '<path d="M11 5L6 9H2v6h4l5 5V5zM23 9l-6 6M17 9l6 6"/>'
        : '<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>';
}

// ─── Utils ───
function showLoading(s) { loading.style.display = s ? 'flex' : 'none'; }
function formatTime(s) { if (isNaN(s)) return '00:00'; const m = Math.floor(s / 60); const sec = Math.floor(s % 60); return `${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`; }
function escapeHtml(str) { return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function toast(msg, type = 'info') {
    let container = $('.toast-container');
    if (!container) { container = document.createElement('div'); container.className = 'toast-container'; document.body.appendChild(container); }
    const el = document.createElement('div');
    el.className = `toast ${type}`; el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => el.remove(), 2500);
}

// ─── Boot ───
bootstrap().catch(console.error);
