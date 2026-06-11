// === DD Music v3.3 - All bugs fixed ===
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

let currentView='home', currentPlatform='netease', currentPlaylist=null, discoverData=[], playlists=[], songs=[], queue=[], currentIndex=-1, isPlaying=false, drawerOpen=false, nowPlayingOpen=false, currentSong=null, lyricLines=[], activeLyricIdx=-1, loopMode='none', favorites=[], playCounts={};
// Pagination state
let playlistTotal=0, playlistOffset=0, playlistLimit=50, playlistLoading=false, currentListId='', currentListPlatform='';

let userState = { netease:{cookie:'',uid:'',nickname:'',avatar:'',loggedIn:false}, github:{token:'',login:'',name:'',avatar:'',id:'',loggedIn:false} };
function loadUserState(){try{var s=localStorage.getItem('dd_music_user');if(s){var d=JSON.parse(s);if(d&&d.github)userState.github=d.github;if(d&&d.netease)userState.netease=d.netease}}catch{}}
function saveUserState(){try{localStorage.setItem('dd_music_user',JSON.stringify(userState))}catch{}}
loadUserState();

function loadFavorites(){try{var s=localStorage.getItem('dd_music_favorites');if(s)favorites=JSON.parse(s)}catch{}}
function saveFavorites(){try{localStorage.setItem('dd_music_favorites',JSON.stringify(favorites))}catch{}}
loadFavorites();

function loadPlayCounts(){try{var s=localStorage.getItem('dd_music_play_counts');if(s)playCounts=JSON.parse(s)}catch{}}
function savePlayCounts(){try{localStorage.setItem('dd_music_play_counts',JSON.stringify(playCounts))}catch{}}
loadPlayCounts();

const audio=$('#audio'); let volume=0.7; if(audio)audio.volume=volume;

// -- Theme --
let isDark=true;
function initTheme(){var s=localStorage.getItem('dd_music_theme');if(s==='light'){isDark=false;document.body.classList.add('light-theme')}updateThemeIcons()}
function toggleTheme(){isDark=!isDark;document.body.classList.toggle('light-theme',!isDark);localStorage.setItem('dd_music_theme',isDark?'dark':'light');updateThemeIcons()}
function updateThemeIcons(){var s=$('.icon-sun'),m=$('.icon-moon');if(s)s.style.display=isDark?'':'none';if(m)m.style.display=isDark?'none':''}
$('#btnTheme').addEventListener('click',toggleTheme); initTheme();

// -- API --
const API_BASE='/api/';
function apiUrl(p){return API_BASE+'?'+new URLSearchParams(p).toString()}
async function apiCall(p){var r=await fetch(apiUrl(p));if(!r.ok)throw new Error('API '+r.status);return r.json()}

// -- Helpers --
function escHtml(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML}
function https(u){return u?u.replace(/^http:/,'https:'):''}
function fmtTime(s){var m=Math.floor(s/60);return m+':'+String(Math.floor(s%60)).padStart(2,'0')}
function isFav(id){return favorites.some(function(f){return f.id===id})}
function getFrequentSongs(){var list=[];for(var id in playCounts){if(playCounts[id]>=10){var f=favorites.find(function(x){return x.id===id})||songs.find(function(x){return x.id===id});if(f)list.push({id:f.id,title:f.title||f.name||'',artist:f.artist||'',img_url:https(f.img_url||f.cover||''),source:f.source||'',count:playCounts[id]})}}list.sort(function(a,b){return b.count-a.count});return list}

// -- View switching --
function switchView(v){currentView=v;$('#viewHome').style.display=v==='home'?'':'none';$('#viewDetail').style.display=v==='detail'?'':'none';$('#viewSearch').style.display=v==='search'?'':'none';$('#viewMine').style.display=v==='mine'?'':'none';$('#breadcrumb').style.display=(v==='detail'||v==='search')?'':'none'}

// -- Drawer --
function openDrawer(){drawerOpen=true;$('#queueDrawer').classList.add('open');$('#drawerBackdrop').classList.add('open')}
function closeDrawer(){drawerOpen=false;$('#queueDrawer').classList.remove('open');$('#drawerBackdrop').classList.remove('open')}
$('#btnQueue').addEventListener('click',function(){drawerOpen?closeDrawer():openDrawer()});
$('#closeDrawer').addEventListener('click',closeDrawer);$('#drawerBackdrop').addEventListener('click',closeDrawer);

// -- Now Playing --
function openNowPlaying(){nowPlayingOpen=true;$('#nowPlaying').style.display='block';document.body.style.overflow='hidden';if(currentSong){updateNowPlayingPage();loadLyric(currentSong)}else{$('#npTitle').textContent='顶点音乐';$('#npArtist').textContent='选择歌曲开始播放';$('#npAlbum').textContent='';$('#npLyrics').innerHTML='<div class="lyrics-placeholder">暂无歌词</div>'}}
function closeNowPlaying(){nowPlayingOpen=false;$('#nowPlaying').style.display='none';document.body.style.overflow='';activeLyricIdx=-1}
$('#playerCoverWrap').addEventListener('click',openNowPlaying);$('#npClose').addEventListener('click',closeNowPlaying);

function updateNowPlayingPage(){if(!currentSong)return;var t=currentSong.title||currentSong.name||'未知',a=currentSong.artist||'',al=currentSong.album||'',c=https(currentSong.img_url||currentSong.cover||'');$('#npTitle').textContent=t;$('#npArtist').textContent=a;$('#npAlbum').textContent=al;if(c){$('#npBg').style.backgroundImage='url('+c+')';$('#npLabel').style.backgroundImage='url('+c+')'}}

// -- Lyric --
function parseLRC(t){if(!t)return[];var ls=t.split('\n'),r=[];ls.forEach(function(l){var m=l.trim().match(/^\[(\d{2}):(\d{2})\.(\d{2,3})\]\s*(.*)/);if(m){var time=parseInt(m[1])*60+parseInt(m[2])+parseInt(m[3])/(m[3].length===2?100:1000);if(m[4].trim())r.push({time:time,text:m[4].trim()})}});r.sort(function(a,b){return a.time-b.time});return r}

async function loadLyric(song){var tid=song.id||'',p=song.source||currentPlatform;if(p==='mine')p='netease';$('#npLyrics').innerHTML='<div class="lyrics-placeholder">加载歌词...</div>';try{var d=await apiCall({action:'lyric',platform:p,trackId:tid});lyricLines=parseLRC(d.lyric||'');if(!lyricLines.length){$('#npLyrics').innerHTML='<div class="lyrics-placeholder">暂无歌词</div>';return}$('#npLyrics').innerHTML=lyricLines.map(function(l,i){return'<div class="lyric-line" data-idx="'+i+'">'+escHtml(l.text)+'</div>'}).join('')}catch(e){$('#npLyrics').innerHTML='<div class="lyrics-placeholder">歌词加载失败</div>'}}

function syncLyric(ct){if(!lyricLines.length||!nowPlayingOpen)return;var idx=-1;for(var i=lyricLines.length-1;i>=0;i--){if(ct>=lyricLines[i].time){idx=i;break}}if(idx===activeLyricIdx)return;activeLyricIdx=idx;var lines=$$('#npLyrics .lyric-line');lines.forEach(function(el,i){i===idx?el.classList.add('active'):el.classList.remove('active')});if(idx>=0&&lines[idx]){var c=$('#npLyrics');c.scrollTop=lines[idx].offsetTop-c.clientHeight/2+lines[idx].clientHeight/2}}

// -- Home --
async function loadHome(){var c=$('#discoverContainer');c.innerHTML='<div class="loading"><div class="spinner"></div><span>加载歌单...</span></div>';try{if(currentPlatform==='netease'){var d=await apiCall({action:'discover',platform:'netease'});discoverData=Array.isArray(d)?d:[];if(!discoverData.length){c.innerHTML='<div class="empty-hint">暂无推荐歌单</div>';return}c.innerHTML=discoverData.map(function(cat){return'<div class="category-section"><div class="category-header"><div class="category-name">'+escHtml(cat.category)+'</div></div><div class="playlist-grid">'+cat.playlists.map(function(p,i){var cv=https(p.cover_img_url||'');return'<div class="playlist-card" data-cat="'+escHtml(cat.category)+'" data-idx="'+i+'"><div class="card-cover"><img src="'+cv+'" alt="" loading="lazy"><div class="card-play-overlay"><div class="card-play-btn"><svg viewBox="0 0 24 24" width="18" height="18" fill="white"><path d="M8 5v14l11-7z"/></svg></div></div></div><div class="card-title">'+escHtml(p.title||'')+'</div></div>'}).join('')+'</div></div>'}).join('')}else{var d=await apiCall({action:'chart',platform:currentPlatform});playlists=Array.isArray(d)?d:(d.playlists||d.list||[]);if(!playlists.length){c.innerHTML='<div class="empty-hint">该平台暂无推荐歌单</div>';return}c.innerHTML='<div class="category-section"><div class="category-header"><div class="category-name">推荐歌单</div></div><div class="playlist-grid">'+playlists.map(function(p,i){var cv=https(p.cover_img_url||p.cover||p.img||'');return'<div class="playlist-card" data-chart-idx="'+i+'"><div class="card-cover"><img src="'+cv+'" alt="" loading="lazy"><div class="card-play-overlay"><div class="card-play-btn"><svg viewBox="0 0 24 24" width="18" height="18" fill="white"><path d="M8 5v14l11-7z"/></svg></div></div></div><div class="card-title">'+escHtml(p.title||p.name||'')+'</div></div>'}).join('')+'</div></div>'}bindPlaylistCards(c)}catch(e){c.innerHTML='<div class="empty-hint">加载失败</div>'}}

function bindPlaylistCards(c){c.querySelectorAll('.playlist-card[data-cat]').forEach(function(card){card.addEventListener('click',function(){var cat=discoverData.find(function(x){return x.category===card.dataset.cat});if(cat&&cat.playlists[parseInt(card.dataset.idx)])openPlaylist(cat.playlists[parseInt(card.dataset.idx)])})});c.querySelectorAll('.playlist-card[data-chart-idx]').forEach(function(card){card.addEventListener('click',function(){var i=parseInt(card.dataset.chartIdx);if(playlists[i])openPlaylist(playlists[i])})})}

// -- My Music Page (REDESIGNED v3.3) --
var mineActiveTab='favorites';
function renderMinePage(){
  var sb=$('#mineSidebar');
  var tabs=[{key:'mine',name:'Mine',icon:'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'},{key:'favorites',name:'收藏',icon:'M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z'},{key:'playlists',name:'歌单',icon:'M4 6h16M4 12h16M4 18h10'},{key:'frequent',name:'常听',icon:'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z'},{key:'upload',name:'上传',icon:'M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z'}];
  sb.innerHTML=tabs.map(function(t){return'<div class="mine-tab'+(mineActiveTab===t.key?' active':'')+'" data-tab="'+t.key+'"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="'+t.icon+'"/></svg><span>'+t.name+'</span></div>'}).join('');
  sb.querySelectorAll('.mine-tab').forEach(function(el){el.addEventListener('click',function(){sb.querySelectorAll('.mine-tab').forEach(function(e){e.classList.remove('active')});el.classList.add('active');mineActiveTab=el.dataset.tab;renderMineContent()})});
  renderMineContent();
}

function renderMineContent(){
  var c=$('#mineContent');
  if(mineActiveTab==='mine') renderMineInfo(c);
  else if(mineActiveTab==='favorites') renderFavorites(c);
  else if(mineActiveTab==='playlists') renderMyPlaylists(c);
  else if(mineActiveTab==='frequent') renderFrequent(c);
  else if(mineActiveTab==='upload') c.innerHTML='<div class="empty-hint"><p style="font-size:14px">功能暂未开放</p><p style="font-size:11px;color:var(--text3);margin-top:6px">上传功能即将上线</p></div>';
}

function renderMineInfo(c){
  if(!userState.github.loggedIn){c.innerHTML='<div class="empty-hint">请先登录</div>';return}
  var avatar=userState.github.avatar||'',name=userState.github.name||userState.github.login||'用户',login=userState.github.login||'';
  // Calculate account age
  var firstLogin=localStorage.getItem('dd_music_first_login')||'';
  if(!firstLogin){firstLogin=String(Date.now());localStorage.setItem('dd_music_first_login',firstLogin)}
  var days=Math.max(1,Math.floor((Date.now()-parseInt(firstLogin))/(1000*60*60*24)));
  // Estimate listening time from play counts
  var totalPlays=0;for(var id in playCounts)totalPlays+=playCounts[id];
  var listenMin=Math.round(totalPlays*3.5);
  var listenStr=listenMin>=60?Math.floor(listenMin/60)+'小时'+(listenMin%60)+'分钟':listenMin+'分钟';
  c.innerHTML='<div class="mine-info-card">'+
    '<div class="mine-avatar-wrap" id="mineAvatarWrap">'+(avatar?'<div class="login-avatar-fallback" style="width:80px;height:80px;font-size:32px">'+escHtml(name.charAt(0).toUpperCase())+'</div>':'<div class="mine-avatar-fallback" style="width:80px;height:80px;font-size:32px">'+escHtml(name.charAt(0).toUpperCase())+'</div>')+'</div>'+
    '<div class="mine-user-name">'+escHtml(name)+'</div>'+
    '<div class="mine-user-login">@'+escHtml(login)+'</div>'+
    '<div class="mine-stats">'+
      '<div class="mine-stat"><div class="mine-stat-val">'+days+'</div><div class="mine-stat-label">使用天数</div></div>'+
      '<div class="mine-stat"><div class="mine-stat-val">'+totalPlays+'</div><div class="mine-stat-label">播放次数</div></div>'+
      '<div class="mine-stat"><div class="mine-stat-val">'+listenStr+'</div><div class="mine-stat-label">听歌时长</div></div>'+
    '</div>'+
    '<button class="btn-logout" id="btnLogout">退出登录</button>'+
  '</div>';
  var lo=$('#btnLogout');if(lo)lo.addEventListener('click',doLogout);
  // Preload avatar for mine info card
  if(avatar){var aw=$('#mineAvatarWrap');if(aw){var mi=new Image();mi.className='mine-avatar';mi.onload=function(){aw.innerHTML='';aw.appendChild(mi)};mi.onerror=function(){/* keep fallback */};mi.src=avatar}}
}

function doLogout(){
  userState.github={token:'',login:'',name:'',avatar:'',id:'',loggedIn:false};
  saveUserState();updateLoginBtn();showToast('已退出登录');
  if(currentView==='mine'){switchView('home');$$('#platformTabs .platform-tab').forEach(function(t){t.classList.remove('active')});var n=$('[data-platform="netease"]');if(n)n.classList.add('active');currentPlatform='netease';loadHome()}
}

function renderFavorites(c){
  if(!favorites.length){c.innerHTML='<div class="empty-hint">还没有收藏歌曲</div>';return}
  c.innerHTML='<div class="category-header"><div class="category-name">我的收藏</div></div>';
  var list=favorites.slice().sort(function(a,b){return(b.ts||0)-(a.ts||0)});
  songs=list;renderSongList(c,list,true);
}

function renderFrequent(c){
  var freq=getFrequentSongs();
  if(!freq.length){c.innerHTML='<div class="empty-hint">还没有常听歌曲<br><span style="font-size:11px;color:var(--text3)">播放超过10次的歌曲会出现在这里</span></div>';return}
  c.innerHTML='<div class="category-header"><div class="category-name">常听歌曲</div></div>';
  songs=freq;renderSongList(c,freq,true);
}

function renderMyPlaylists(c){
  var platforms=[{key:'netease',name:'网易云',color:'#D81E06'},{key:'qq',name:'QQ音乐',color:'#31c27c'},{key:'kugou',name:'酷狗',color:'#2e8bff'},{key:'kuwo',name:'酷我',color:'#ffcc00'},{key:'migu',name:'咪咕',color:'#e5004f'},{key:'bilibili',name:'B站',color:'#fb7299'}];
  c.innerHTML='<div class="mine-plat-tabs" id="minePlatTabs">'+platforms.map(function(p){var bound=userState[p.key]&&userState[p.key].loggedIn;return'<button class="mine-plat-tab'+(p.key==='netease'?' active':'')+'" data-pk="'+p.key+'" style="--pc:'+p.color+'"><span>'+p.name+'</span>'+(bound?'<span class="bound-dot"></span>':'')+'</button>'}).join('')+'</div><div class="mine-plat-content" id="minePlatContent"></div>';
  c.querySelectorAll('.mine-plat-tab').forEach(function(tab){tab.addEventListener('click',function(){c.querySelectorAll('.mine-plat-tab').forEach(function(t){t.classList.remove('active')});tab.classList.add('active');loadPlatformPlaylists(tab.dataset.pk)})});
  loadPlatformPlaylists('netease');
}

async function loadPlatformPlaylists(pk){
  var c=$('#minePlatContent');if(!c)return;
  if(pk!=='netease'){c.innerHTML='<div class="empty-hint"><p>功能暂未开放</p><p style="font-size:11px;color:var(--text3);margin-top:6px">该平台绑定即将上线</p></div>';return}
  if(!userState.netease.loggedIn||!userState.netease.cookie||!userState.netease.uid){
    c.innerHTML='<div class="empty-hint"><p>未绑定网易云账号</p><button class="btn-primary" style="width:auto;margin-top:12px" id="btnBindNetease">绑定账号</button></div>';
    var btn=$('#btnBindNetease');if(btn)btn.addEventListener('click',function(){openBindModal('netease')});
    return;
  }
  c.innerHTML='<div class="loading"><div class="spinner"></div><span>加载歌单...</span></div>';
  try{var d=await apiCall({action:'user_playlist',platform:'netease',uid:userState.netease.uid,cookie:userState.netease.cookie});var pls=d.playlists||[];if(!pls.length){c.innerHTML='<div class="empty-hint">暂无歌单</div>';return}c.innerHTML='<div class="playlist-grid">'+pls.map(function(p,i){var cv=https(p.cover_img_url||'');return'<div class="playlist-card" data-mine-idx="'+i+'"><div class="card-cover"><img src="'+cv+'" alt="" loading="lazy"><div class="card-play-overlay"><div class="card-play-btn"><svg viewBox="0 0 24 24" width="18" height="18" fill="white"><path d="M8 5v14l11-7z"/></svg></div></div></div><div class="card-title">'+escHtml(p.title||'')+'</div></div>'}).join('')+'</div>';playlists=pls;c.querySelectorAll('.playlist-card[data-mine-idx]').forEach(function(card){card.addEventListener('click',function(){var i=parseInt(card.dataset.mineIdx);if(playlists[i])openPlaylist(playlists[i])})})}catch(e){c.innerHTML='<div class="empty-hint">加载失败</div>'}
}

// -- Bind Cookie Modal --
var bindPlatform='';
function openBindModal(platform){bindPlatform=platform;$('#bindModalTitle').textContent='绑定'+(platform==='netease'?'网易云':'平台');$('#bindModalHint').textContent=platform==='netease'?'粘贴你的网易云Cookie（从浏览器开发者工具获取 Music_u 值）':'';$('#bindCookieInput').value='';$('#bindStatus').innerHTML='';$('#bindModal').style.display=''}
$('#closeBindModal').addEventListener('click',function(){$('#bindModal').style.display='none'});
$('#bindModal').addEventListener('click',function(e){if(e.target===$('#bindModal'))$('#bindModal').style.display='none'});

$('#bindCookieBtn').addEventListener('click',async function(){
  var cookie=$('#bindCookieInput').value.trim();if(!cookie){$('#bindStatus').innerHTML='<div class="login-error">请输入Cookie</div>';return}
  $('#bindLoading').style.display='';
  try{if(bindPlatform==='netease'){
    var d=await apiCall({action:'login_check',platform:'netease',cookie:cookie});
    if(d.ok){userState.netease={cookie:cookie,uid:String(d.uid),nickname:d.nickname,avatar:https(d.avatar||''),loggedIn:true};saveUserState();
      if(userState.github.loggedIn)apiCall({action:'netease_bind',github_id:userState.github.id,ne_cookie:cookie}).catch(function(){})
      $('#bindStatus').innerHTML='<div class="login-success">✓ 绑定成功：'+escHtml(d.nickname)+'</div>';showToast('网易云绑定成功');setTimeout(function(){$('#bindModal').style.display='none';renderMinePage()},1000)
    }else{$('#bindStatus').innerHTML='<div class="login-error">✗ Cookie无效</div>'}
  }}catch(e){$('#bindStatus').innerHTML='<div class="login-error">✗ 验证失败</div>'}finally{$('#bindLoading').style.display='none'}
});

// -- Login button (v3.3: no popup, background-image for avatar) --
$('#btnLogin').addEventListener('click',function(){
  if(userState.github.loggedIn){switchView('mine');mineActiveTab='mine';renderMinePage();$$('#platformTabs .platform-tab').forEach(function(t){t.classList.remove('active')});var m=$('[data-platform="mine"]');if(m)m.classList.add('active')}
  else openLoginModal();
});

// -- Login (GitHub) --
function openLoginModal(){$('#loginModal').style.display=''}
$('#closeLoginModal').addEventListener('click',function(){$('#loginModal').style.display='none'});
$('#loginModal').addEventListener('click',function(e){if(e.target===$('#loginModal'))$('#loginModal').style.display='none'});
$('#ghLoginBtn').addEventListener('click',async function(){try{var d=await apiCall({action:'oauth_url'});if(d.url)window.location.href=d.url}catch(e){showToast('获取授权链接失败')}});

function checkOAuthCallback(){
  // Channel 1: hash fragment
  var h=location.hash;
  console.log('[DD] checkOAuth hash:', h ? h.substring(0,30) : '(empty)');
  if(h.startsWith('#oauth=')){
    try{var d=JSON.parse(decodeURIComponent(h.slice(7)));
      console.log('[DD] OAuth hash data ok:', d&&d.ok, 'login:', d&&d.login);
      if(d&&d.ok){
      userState.github={token:d.token||'',login:d.login||'',name:d.name||d.login||'',avatar:https(d.avatar||''),id:String(d.id||''),loggedIn:true};
      saveUserState();updateLoginBtn();showToast('✓ GitHub登录成功：'+userState.github.name);
      if(!localStorage.getItem('dd_music_first_login'))localStorage.setItem('dd_music_first_login',String(Date.now()));
      if(userState.github.id)apiCall({action:'listen_record',github_id:userState.github.id}).catch(function(){})
    }}catch(e){console.warn('[DD] OAuth hash parse error',e);showToast('OAuth解析失败')}
    history.replaceState(null,'','/');
    return;
  }
  if(h.startsWith('#oauth_error=')){showToast('登录失败: '+decodeURIComponent(h.slice(14)));history.replaceState(null,'','/');return}

  // Channel 2: cookie backup (some browsers lose hash on 302 redirect)
  try{
    var cookies=document.cookie;
    console.log('[DD] all cookies:', cookies || '(none)');
    var cArr=cookies.split(';');
    for(var i=0;i<cArr.length;i++){
      var c=cArr[i].trim();
      if(c.startsWith('dd_oauth=')){
        var val=JSON.parse(decodeURIComponent(c.slice(10)));
        console.log('[DD] OAuth cookie data ok:', val&&val.ok, 'login:', val&&val.l);
        if(val&&val.ok){
          userState.github={token:val.t||'',login:val.l||'',name:val.n||val.l||'',avatar:https(val.a||''),id:val.i||'',loggedIn:true};
          saveUserState();updateLoginBtn();showToast('✓ GitHub登录成功：'+userState.github.name);
          if(!localStorage.getItem('dd_music_first_login'))localStorage.setItem('dd_music_first_login',String(Date.now()));
          if(userState.github.id)apiCall({action:'listen_record',github_id:userState.github.id}).catch(function(){})
        }
        document.cookie='dd_oauth=; Path=/; Max-Age=0; SameSite=Lax; Secure';
        break;
      }
    }
  }catch(e){console.warn('[DD] OAuth cookie parse error',e)}
}

// Bulletproof avatar: preload image, then replace button content
// No background-image (CSS reset overrides it), no <img onerror> race condition
function updateLoginBtn(){
  var btn=$('#btnLogin');
  if(!btn){console.log('[DD] updateLoginBtn: btn NOT FOUND');return}
  if(userState.github.loggedIn){
    var name=userState.github.name||userState.github.login||'U';
    var initial=escHtml(name.charAt(0).toUpperCase());
    var av=userState.github.avatar;
    btn.title=name;
    console.log('[DD] updateLoginBtn: LOGGED IN name='+name+' avatar='+(av?av.substring(0,50):'(empty)'));
    if(av){
      btn.innerHTML='<div class="login-avatar-fallback">'+initial+'</div>';
      var img=new Image();
      img.onload=function(){console.log('[DD] Avatar loaded OK');btn.innerHTML='<img class="login-avatar-img" src="'+av+'" alt="">'};
      img.onerror=function(){console.log('[DD] Avatar load FAILED, using fallback');btn.innerHTML='<div class="login-avatar-fallback">'+initial+'</div>'};
      img.src=av;
    }else{
      console.log('[DD] No avatar URL, showing initial fallback');
      btn.innerHTML='<div class="login-avatar-fallback">'+initial+'</div>';
    }
  }else{
    console.log('[DD] updateLoginBtn: NOT logged in');
    btn.innerHTML='<svg class="icon-default" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
    btn.title='登录';
  }
}

// -- Song Actions --
async function toggleFavorite(song){var id=song.id||'';if(!id)return;var idx=favorites.findIndex(function(f){return f.id===id});if(idx>=0){favorites.splice(idx,1);showToast('取消收藏');if(userState.github.loggedIn)apiCall({action:'favorite_remove',github_id:userState.github.id,song_id:id}).catch(function(){})}else{favorites.push({id:id,title:song.title||song.name||'',artist:song.artist||'',img_url:https(song.img_url||song.cover||''),source:song.source||currentPlatform,ts:Date.now()});showToast('已收藏');if(userState.github.loggedIn)apiCall({action:'favorite_add',github_id:userState.github.id,song_id:id,song_title:song.title||song.name||'',song_artist:song.artist||'',song_cover:https(song.img_url||song.cover||''),song_source:song.source||currentPlatform}).catch(function(){})}saveFavorites();if(currentView==='detail'){songs=currentPlaylist?songs:songs;renderSongList($('#songList'),songs,true)}else if(currentView==='search')renderSongList($('#searchList'),songs,true);else if(currentView==='mine')renderMineContent()}

async function downloadSong(song){var tid=song.id||'';if(!tid)return;showToast('获取下载链接...');try{var p=song.source||currentPlatform;if(p==='mine')p='netease';var d=await apiCall({action:'bootstrap',platform:p,trackId:tid});if(d.url){showToast('下载中...');try{var r=await fetch(d.url);if(r.ok){var b=await r.blob();var u=URL.createObjectURL(b);var a=document.createElement('a');a.href=u;a.download=(song.title||song.name||'music')+'.mp3';document.body.appendChild(a);a.click();document.body.removeChild(a);setTimeout(function(){URL.revokeObjectURL(u)},1000);showToast('下载完成')}else throw new Error('status')}catch(corsErr){var a=document.createElement('a');a.href=d.url;a.download=(song.title||song.name||'music')+'.mp3';a.target='_blank';a.rel='noopener';document.body.appendChild(a);a.click();document.body.removeChild(a);showToast('已打开下载链接')}}else showToast('暂无下载源')}catch(e){showToast('下载失败')}}

function shareSong(song){var id=song.id||'',p=song.source||currentPlatform,t=song.title||song.name||'分享音乐',a=song.artist||'',u='https://ddmusic.eu.cc/#play='+p+'_'+encodeURIComponent(id),txt=t+' - '+a+' | 顶点音乐 '+u;if(navigator.share)navigator.share({title:t+' - '+a,url:u}).catch(function(){});else navigator.clipboard.writeText(txt).then(function(){showToast('链接已复制')}).catch(function(){showToast('分享失败')})}

// -- Audio wave loading indicator --
var _audioWaveEl=null;
function showAudioWave(){
  if(_audioWaveEl)return;
  var w=document.createElement('div');w.className='audio-wave';
  w.innerHTML='<span></span><span></span><span></span><span></span><span></span>';
  document.body.appendChild(w);_audioWaveEl=w;
}
function hideAudioWave(){if(_audioWaveEl){_audioWaveEl.remove();_audioWaveEl=null}}

// -- Playlist detail with pagination --
async function openPlaylist(p){
  currentPlaylist=p;switchView('detail');
  $('#breadcrumbTitle').textContent=p.title||p.name||'歌单';
  var cv=https(p.cover_img_url||p.cover||p.img||p.picUrl||p.pic||''),nm=p.title||p.name||'未知歌单';
  $('#detailHeader').innerHTML='<div class="detail-cover"><img src="'+cv+'" alt=""></div><div class="detail-info"><div class="detail-name">'+escHtml(nm)+'</div><button class="btn-play-all" id="btnPlayAll">播放全部</button></div>';
  var list=$('#songList');
  list.innerHTML='<div class="loading"><div class="spinner"></div><span>加载歌曲...</span></div>';
  // Reset pagination
  songs=[];playlistOffset=0;playlistTotal=0;
  currentListId=p.id||p.listId||'';currentListPlatform=p.source||currentPlatform;
  if(currentListPlatform==='mine')currentListPlatform='netease';
  await loadPlaylistPage();
  var pa=$('#btnPlayAll');if(pa)pa.addEventListener('click',function(){playAll(songs)})
}

async function loadPlaylistPage(){
  if(playlistLoading)return;playlistLoading=true;
  var list=$('#songList');
  // Show loading at bottom if appending
  if(songs.length>0){
    var loader=document.createElement('div');loader.className='loading';loader.id='pageLoader';
    loader.innerHTML='<div class="spinner"></div><span>加载更多...</span>';
    list.appendChild(loader)
  }
  try{
    var d=await apiCall({action:'chart',platform:currentListPlatform,listId:currentListId,offset:playlistOffset,limit:playlistLimit});
    var newSongs=d.tracks||d.list||(Array.isArray(d)?d:[]);
    playlistTotal=d.total||newSongs.length;
    // Remove loader
    var loader=$('#pageLoader');if(loader)loader.remove();
    if(!newSongs.length&&songs.length===0){list.innerHTML='<div class="empty-hint">歌单内暂无歌曲</div>';playlistLoading=false;return}
    songs=songs.concat(newSongs);playlistOffset=songs.length;
    // Re-render full list
    list.innerHTML='';
    renderSongList(list,songs,true);
    // Add "load more" button if there are more songs
    if(playlistOffset<playlistTotal){
      var moreBtn=document.createElement('button');moreBtn.className='btn-load-more';moreBtn.id='btnLoadMore';
      moreBtn.textContent='加载更多 ('+playlistOffset+'/'+playlistTotal+')';
      list.appendChild(moreBtn);
      moreBtn.addEventListener('click',function(){loadPlaylistPage()})
    }
  }catch(e){
    var loader=$('#pageLoader');if(loader)loader.remove();
    if(songs.length===0)list.innerHTML='<div class="empty-hint">加载失败</div>';
    else showToast('加载更多失败')
  }
  playlistLoading=false
}

// FIX: renderSongList uses innerHTML= (REPLACE not APPEND)
function renderSongList(container,list,isMine){
  var html=list.map(function(s,i){var t=s.title||s.name||'未知',a=s.artist||s.artistsname||s.author||'',al=s.album||s.albumname||'',cv=https(s.img_url||s.cover||s.img||s.picUrl||(s.al&&s.al.picUrl)||''),dur=s.duration||0,fav=isFav(s.id||''),cnt=s.count||0;return'<div class="song-item" data-idx="'+i+'"><div class="song-idx">'+(i+1)+'</div><div class="song-cover"><img src="'+cv+'" alt="" loading="lazy"></div><div class="song-info"><div class="song-title">'+escHtml(t)+'</div><div class="song-sub">'+escHtml(a)+(al?' · '+escHtml(al):'')+(dur?' <span class="song-dur">'+fmtTime(dur)+'</span>':'')+(cnt?' <span class="song-cnt">'+cnt+'次</span>':'')+'</div></div><div class="song-actions"><button class="btn-action btn-fav '+(fav?'active':'')+'" data-idx="'+i+'" title="收藏"><svg viewBox="0 0 24 24" width="14" height="14" fill="'+(fav?'currentColor':'none')+'" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg></button><button class="btn-action btn-add-queue" data-idx="'+i+'" title="加入队列"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg></button><button class="btn-action btn-download" data-idx="'+i+'" title="下载"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg></button><button class="btn-action btn-share" data-idx="'+i+'" title="分享"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98"/></svg></button></div></div>'}).join('');
  var existing=container.innerHTML;
  // If container has category-header or detail-header, preserve it, replace the rest
  var headerMatch=existing.match(/^(<div class="category-header">.*?<\/div>)/s);
  container.innerHTML=(headerMatch?headerMatch[1]:'')+html;
  container.querySelectorAll('.song-item').forEach(function(item){var idx=parseInt(item.dataset.idx);item.addEventListener('click',function(e){if(e.target.closest('.btn-action'))return;playSongFromList(idx)});item.querySelector('.btn-fav').addEventListener('click',function(e){e.stopPropagation();toggleFavorite(list[idx])});item.querySelector('.btn-add-queue').addEventListener('click',function(e){e.stopPropagation();addToQueue(idx)});item.querySelector('.btn-download').addEventListener('click',function(e){e.stopPropagation();downloadSong(list[idx])});item.querySelector('.btn-share').addEventListener('click',function(e){e.stopPropagation();shareSong(list[idx])})});
}

// -- Search --
var searchTimer=null;
$('#searchInput').addEventListener('input',function(e){clearTimeout(searchTimer);var q=e.target.value.trim();if(!q){if(currentView==='search')switchView('home');return}searchTimer=setTimeout(function(){doSearch(q)},400)});
$('#searchInput').addEventListener('keydown',function(e){if(e.key==='Enter'){clearTimeout(searchTimer);var q=e.target.value.trim();if(q)doSearch(q)}});

async function doSearch(q){switchView('search');$('#searchTitle').textContent='搜索：'+q;$('#breadcrumbTitle').textContent='搜索结果';var l=$('#searchList');l.innerHTML='<div class="loading"><div class="spinner"></div><span>搜索中...</span></div>';try{var d=await apiCall({action:'search',platform:currentPlatform,keyword:q});songs=d.result||d.list||d.tracks||(Array.isArray(d)?d:[]);if(!songs.length){l.innerHTML='<div class="empty-hint">未找到结果</div>';return}l.innerHTML='';renderSongList(l,songs,true)}catch(e){l.innerHTML='<div class="empty-hint">搜索失败</div>'}}

// -- Playback --
async function playSongFromList(idx){var s=songs[idx];if(!s)return;currentIndex=idx;queue=songs.slice();updateQueueUI();showAudioWave();try{var u=await resolveUrl(s);if(u)loadAndPlay(s,u);else{hideAudioWave();showToast('暂无播放源')}}catch(e){hideAudioWave();showToast('播放失败')}}

async function playAll(list){if(!list.length)return;queue=list.slice();songs=list.slice();currentIndex=0;updateQueueUI();showAudioWave();try{var u=await resolveUrl(queue[0]);if(u)loadAndPlay(queue[0],u);else{hideAudioWave();showToast('暂无播放源')}}catch(e){hideAudioWave();showToast('播放失败')}}

async function resolveUrl(song){var tid=song.id||'';if(!tid)return null;var p=song.source||currentPlatform;if(p==='mine')p='netease';try{var d=await apiCall({action:'bootstrap',platform:p,trackId:tid});return d.url||null}catch(e){return null}}

function loadAndPlay(song,url){hideAudioWave();audio.src=url;audio.play().catch(function(e){console.warn('play blocked:',e)});isPlaying=true;currentSong=song;updatePlayBtn();updateNowPlaying(song);recordListen(song)}

function updateNowPlaying(song){currentSong=song;var t=song.title||song.name||'未知',a=song.artist||song.artistsname||song.author||'',cv=https(song.img_url||song.cover||song.img||song.picUrl||song.pic||(song.al&&song.al.picUrl)||'');$('#playerTitle').textContent=t;$('#playerArtist').textContent=a;var img=$('#playerCover'),logo=$('#playerCoverLogo');if(cv){img.src=cv;img.style.display='';logo.style.display='none'}else{img.style.display='none';logo.style.display=''}var pn={netease:'网易云',qq:'QQ音乐',kugou:'酷狗',kuwo:'酷我',bilibili:'B站',migu:'咪咕'};$('#platformBadge').textContent=pn[currentPlatform]||'';document.title=t+' - '+a+' | 顶点音乐';if(nowPlayingOpen)updateNowPlayingPage()}

function recordListen(song){try{var h=JSON.parse(localStorage.getItem('dd_music_listen_history')||'[]');h.push({id:song.id,title:song.title||song.name,artist:song.artist,ts:Date.now()});if(h.length>500)h=h.slice(-500);localStorage.setItem('dd_music_listen_history',JSON.stringify(h))}catch{};var id=song.id||'';if(id){playCounts[id]=(playCounts[id]||0)+1;savePlayCounts();if(userState.github.loggedIn)apiCall({action:'listen_record',github_id:userState.github.id,song_id:id,song_title:song.title||song.name||'',song_artist:song.artist||'',song_source:song.source||currentPlatform}).catch(function(){})}}

function addToQueue(idx){var s=songs[idx];if(!s)return;queue.push(s);updateQueueUI();showToast('已加入队列')}
function removeFromQueue(idx){queue.splice(idx,1);if(currentIndex>=queue.length)currentIndex=queue.length-1;updateQueueUI()}

function updateQueueUI(){var l=$('#queueList');$('#queueCount').textContent=queue.length;var dot=$('#queueDot');queue.length>0?dot.classList.add('has-items'):dot.classList.remove('has-items');if(!queue.length){l.innerHTML='<div class="empty-hint">播放队列为空</div>';return}l.innerHTML=queue.map(function(s,i){var t=s.title||s.name||'未知',a=s.artist||'',cv=https(s.img_url||s.cover||s.img||s.picUrl||(s.al&&s.al.picUrl)||''),ac=i===currentIndex?' active':'';return'<div class="queue-item'+ac+'" data-idx="'+i+'"><div class="qi-cover"><img src="'+cv+'" alt="" loading="lazy"></div><div class="qi-info"><span class="qi-title">'+escHtml(t)+'</span><span class="qi-artist">'+escHtml(a)+'</span></div><button class="qi-remove" data-idx="'+i+'"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button></div>'}).join('');l.querySelectorAll('.queue-item').forEach(function(item){item.addEventListener('click',function(e){if(e.target.closest('.qi-remove')){removeFromQueue(parseInt(item.dataset.idx));return}currentIndex=parseInt(item.dataset.idx);var s=queue[currentIndex];resolveUrl(s).then(function(u){if(u)loadAndPlay(s,u)})})})}

// -- Loop --
$('#btnLoop').addEventListener('click',function(){if(loopMode==='none'){loopMode='one';audio.loop=true;showToast('单曲循环')}else if(loopMode==='one'){loopMode='all';audio.loop=false;showToast('列表循环')}else{loopMode='none';audio.loop=false;showToast('取消循环')}updateLoopIcon()});
function updateLoopIcon(){var i=$('#loopIcon'),b=$('#btnLoop');b.classList.remove('loop-one','loop-all');if(loopMode==='one'){b.classList.add('loop-one');i.innerHTML='<path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/><text x="12" y="15" text-anchor="middle" font-size="6" fill="currentColor" stroke="none">1</text>'}else if(loopMode==='all'){b.classList.add('loop-all');i.innerHTML='<path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/>'}else{i.innerHTML='<path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/>'}}

// -- Player controls --
$('#btnPlay').addEventListener('click',function(){if(!audio.src)return;if(isPlaying){audio.pause();isPlaying=false}else{audio.play().catch(function(){});isPlaying=true}updatePlayBtn()});
$('#btnPrev').addEventListener('click',function(){if(!queue.length)return;currentIndex=(currentIndex-1+queue.length)%queue.length;var s=queue[currentIndex];resolveUrl(s).then(function(u){if(u)loadAndPlay(s,u)})});
$('#btnNext').addEventListener('click',function(){if(!queue.length)return;if(loopMode!=='one')currentIndex=(currentIndex+1)%queue.length;var s=queue[currentIndex];resolveUrl(s).then(function(u){if(u)loadAndPlay(s,u)})});
$('#npPlay').addEventListener('click',function(){$('#btnPlay').click()});$('#npPrev').addEventListener('click',function(){$('#btnPrev').click()});$('#npNext').addEventListener('click',function(){$('#btnNext').click()});
$('#npProgressBar').addEventListener('click',function(e){if(!audio.duration)return;var r=e.currentTarget.getBoundingClientRect();audio.currentTime=((e.clientX-r.left)/r.width)*audio.duration});

function updatePlayBtn(){var i=$('#playIcon'),ni=$('#npPlayIcon'),cw=$('#playerCoverWrap');if(isPlaying){i.innerHTML='<path d="M6 4h4v16H6zM14 4h4v16h-4z"/>';ni.innerHTML='<path d="M6 4h4v16H6zM14 4h4v16h-4z"/>';$('#btnPlay').classList.add('playing');$('#npPlay').classList.add('playing');$('#player').classList.add('active');$('#npVinyl').classList.add('spinning');if(cw)cw.classList.add('spinning')}else{i.innerHTML='<path d="M8 5v14l11-7z"/>';ni.innerHTML='<path d="M8 5v14l11-7z"/>';$('#btnPlay').classList.remove('playing');$('#npPlay').classList.remove('playing');$('#player').classList.remove('active');$('#npVinyl').classList.remove('spinning');if(cw)cw.classList.remove('spinning')}}

audio.addEventListener('timeupdate',function(){if(!audio.duration)return;var p=(audio.currentTime/audio.duration)*100;$('#progressFill').style.width=p+'%';$('#currentTime').textContent=fmtTime(audio.currentTime);$('#duration').textContent=fmtTime(audio.duration);if(nowPlayingOpen){$('#npProgressFill').style.width=p+'%';$('#npCurrentTime').textContent=fmtTime(audio.currentTime);$('#npDuration').textContent=fmtTime(audio.duration);syncLyric(audio.currentTime)}});
$('#progressBar').addEventListener('click',function(e){if(!audio.duration)return;var r=e.currentTarget.getBoundingClientRect();audio.currentTime=((e.clientX-r.left)/r.width)*audio.duration});
$('#btnVolume').addEventListener('click',function(){audio.muted=!audio.muted;updateVolumeIcon()});
$('#volumeBar').addEventListener('click',function(e){var r=e.currentTarget.getBoundingClientRect();volume=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));audio.volume=volume;audio.muted=false;$('#volumeFill').style.width=(volume*100)+'%';updateVolumeIcon()});
function updateVolumeIcon(){var i=$('#volumeIcon');if(audio.muted||volume===0)i.innerHTML='<path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.56-1.42 1.01-2.25 1.32v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>';else i.innerHTML='<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>'}
audio.addEventListener('ended',function(){if(loopMode==='one')return;if(queue.length){if(loopMode==='all')currentIndex=(currentIndex+1)%queue.length;else{currentIndex++;if(currentIndex>=queue.length){isPlaying=false;updatePlayBtn();return}}var s=queue[currentIndex];resolveUrl(s).then(function(u){if(u)loadAndPlay(s,u)})}});
audio.addEventListener('error',function(){showToast('播放失败')});

function showToast(msg){var t=document.createElement('div');t.className='toast';t.textContent=msg;document.body.appendChild(t);requestAnimationFrame(function(){t.classList.add('show')});setTimeout(function(){t.classList.remove('show');setTimeout(function(){t.remove()},300)},2500)}
$('#clearPlaylist').addEventListener('click',function(){queue=[];currentIndex=-1;updateQueueUI()});
$('#btnBack').addEventListener('click',function(){if(currentView!=='home'){switchView('home');$('#searchInput').value=''}});

$$('#platformTabs .platform-tab').forEach(function(tab){tab.addEventListener('click',function(){$$('#platformTabs .platform-tab').forEach(function(t){t.classList.remove('active')});tab.classList.add('active');currentPlatform=tab.dataset.platform;if(currentPlatform==='mine'){switchView('mine');renderMinePage()}else{switchView('home');loadHome()}})});

document.addEventListener('keydown',function(e){if(e.target.tagName==='INPUT')return;if(e.code==='Space'){e.preventDefault();$('#btnPlay').click()}if(e.code==='Escape'&&nowPlayingOpen)closeNowPlaying()});

checkOAuthCallback();
// Debug: show login state on load
console.log('[DD] After checkOAuth: loggedIn='+userState.github.loggedIn+(userState.github.loggedIn?' name='+userState.github.name+' avatar='+(userState.github.avatar||'').substring(0,50):''));
showToast(userState.github.loggedIn?'已登录: '+userState.github.name:'未登录');
updateLoginBtn();loadHome();

// Safety net: re-apply avatar every 2s if login state doesn't match button appearance
// This catches: CDN cache serving old JS, race conditions, anything that overwrites the button
var _lastLoginState=userState.github.loggedIn;
setInterval(function(){
  if(userState.github.loggedIn!==_lastLoginState){
    _lastLoginState=userState.github.loggedIn;
    updateLoginBtn();
  }
  // Also check if button content got reset (e.g., by cached old code)
  var btn=$('#btnLogin');
  if(btn&&userState.github.loggedIn){
    var hasAvatar=btn.querySelector('.login-avatar-img')||btn.querySelector('.login-avatar-fallback');
    if(!hasAvatar){updateLoginBtn()}
  }
},2000);
