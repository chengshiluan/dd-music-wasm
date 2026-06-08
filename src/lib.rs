use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

// ─── Platform definitions ───

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Platform {
    pub id: String,
    pub name: String,
    pub search_url: String,
    pub color: String,
}

#[wasm_bindgen]
pub fn get_platforms() -> String {
    let platforms = vec![
        Platform {
            id: "netease".into(),
            name: "网易云".into(),
            search_url: "https://music.163.com/api/search/get".into(),
            color: "#e60026".into(),
        },
        Platform {
            id: "qq".into(),
            name: "QQ音乐".into(),
            search_url: "https://c.y.qq.com/soso/fcgi-bin/client_search_cp".into(),
            color: "#31c27c".into(),
        },
        Platform {
            id: "kugou".into(),
            name: "酷狗".into(),
            search_url: "https://songsearch.kugou.com/song_search_v2".into(),
            color: "#2e8bff".into(),
        },
        Platform {
            id: "kuwo".into(),
            name: "酷我".into(),
            search_url: "https://www.kuwo.cn/api/www/search/searchMusicBykeyWord".into(),
            color: "#ffcc00".into(),
        },
        Platform {
            id: "bilibili".into(),
            name: "B站".into(),
            search_url: "https://api.bilibili.com/x/web-interface/search/type".into(),
            color: "#fb7299".into(),
        },
        Platform {
            id: "migu".into(),
            name: "咪咕".into(),
            search_url: "https://m.music.migu.cn/migu/remoting/scr_search_tag".into(),
            color: "#e5004f".into(),
        },
    ];
    serde_json::to_string(&platforms).unwrap()
}

// ─── Song data ───

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Song {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub platform: String,
    pub cover_url: String,
    pub audio_url: String,
    pub lyric_url: String,
    pub duration: u64,
}

#[wasm_bindgen]
pub fn parse_netease_search(data: &str) -> String {
    let parsed: serde_json::Value = match serde_json::from_str(data) {
        Ok(v) => v,
        Err(_) => return "[]".into(),
    };
    let mut songs: Vec<Song> = Vec::new();
    if let Some(songs_data) = parsed["result"]["songs"].as_array() {
        for item in songs_data {
            let id = item["id"].as_i64().map(|i| i.to_string()).unwrap_or_default();
            let title = item["name"].as_str().unwrap_or("未知").to_string();
            let artist = item["artists"][0]["name"].as_str().unwrap_or("未知").to_string();
            let album = item["album"]["name"].as_str().unwrap_or("").to_string();
            let cover_url = item["album"]["picUrl"].as_str().unwrap_or("").to_string();
            let duration = item["duration"].as_i64().unwrap_or(0) as u64;
            songs.push(Song {
                id,
                title,
                artist,
                album,
                platform: "netease".into(),
                cover_url,
                audio_url: "".into(),
                lyric_url: "".into(),
                duration,
            });
        }
    }
    serde_json::to_string(&songs).unwrap()
}

#[wasm_bindgen]
pub fn build_netease_song_url(song_id: &str) -> String {
    format!("https://music.163.com/song/media/outer/url?id={}.mp3", song_id)
}

#[wasm_bindgen]
pub fn build_netease_lyric_url(song_id: &str) -> String {
    format!("https://music.163.com/api/song/lyric?id={}&lv=1", song_id)
}

// ─── QQ Music parsing ───

#[wasm_bindgen]
pub fn parse_qq_search(data: &str) -> String {
    let parsed: serde_json::Value = match serde_json::from_str(data) {
        Ok(v) => v,
        Err(_) => return "[]".into(),
    };
    let mut songs: Vec<Song> = Vec::new();
    if let Some(list) = parsed["data"]["song"]["list"].as_array() {
        for item in list {
            let songmid = item["songmid"].as_str().unwrap_or("").to_string();
            let title = item["songname"].as_str().unwrap_or("未知").to_string();
            let artist = item["singer"][0]["name"].as_str().unwrap_or("未知").to_string();
            let album = item["albumname"].as_str().unwrap_or("").to_string();
            let albummid = item["albummid"].as_str().unwrap_or("").to_string();
            let cover_url = if !albummid.is_empty() {
                format!("https://y.gtimg.cn/music/photo_new/T002R300x300M000{}.jpg", albummid)
            } else {
                String::new()
            };
            let duration = item["interval"].as_i64().unwrap_or(0) as u64;
            songs.push(Song {
                id: songmid,
                title,
                artist,
                album,
                platform: "qq".into(),
                cover_url,
                audio_url: "".into(),
                lyric_url: "".into(),
                duration,
            });
        }
    }
    serde_json::to_string(&songs).unwrap()
}

// ─── Kugou parsing ───

#[wasm_bindgen]
pub fn parse_kugou_search(data: &str) -> String {
    let parsed: serde_json::Value = match serde_json::from_str(data) {
        Ok(v) => v,
        Err(_) => return "[]".into(),
    };
    let mut songs: Vec<Song> = Vec::new();
    if let Some(list) = parsed["data"]["lists"].as_array() {
        for item in list {
            let id = item["FileHash"].as_str().unwrap_or("").to_string();
            let title = item["SongName"].as_str().unwrap_or("未知").to_string();
            let artist = item["SingerName"].as_str().unwrap_or("未知").to_string();
            let album = item["AlbumName"].as_str().unwrap_or("").to_string();
            let cover_url = item["AlbumID"].as_str().unwrap_or("").to_string();
            let duration = item["Duration"].as_i64().unwrap_or(0) as u64;
            songs.push(Song {
                id,
                title,
                artist,
                album,
                platform: "kugou".into(),
                cover_url,
                audio_url: "".into(),
                lyric_url: "".into(),
                duration,
            });
        }
    }
    serde_json::to_string(&songs).unwrap()
}

// ─── Kuwo parsing ───

#[wasm_bindgen]
pub fn parse_kuwo_search(data: &str) -> String {
    let parsed: serde_json::Value = match serde_json::from_str(data) {
        Ok(v) => v,
        Err(_) => return "[]".into(),
    };
    let mut songs: Vec<Song> = Vec::new();
    if let Some(list) = parsed["data"]["list"].as_array() {
        for item in list {
            let id = item["rid"].as_i64().map(|i| i.to_string()).unwrap_or_default();
            let title = item["name"].as_str().unwrap_or("未知").to_string();
            let artist = item["artist"].as_str().unwrap_or("未知").to_string();
            let album = item["album"].as_str().unwrap_or("").to_string();
            let cover_url = item["pic"].as_str().unwrap_or("").to_string();
            let duration = item["duration"].as_i64().unwrap_or(0) as u64;
            songs.push(Song {
                id,
                title,
                artist,
                album,
                platform: "kuwo".into(),
                cover_url,
                audio_url: "".into(),
                lyric_url: "".into(),
                duration,
            });
        }
    }
    serde_json::to_string(&songs).unwrap()
}

// ─── Bilibili parsing ───

#[wasm_bindgen]
pub fn parse_bilibili_search(data: &str) -> String {
    let parsed: serde_json::Value = match serde_json::from_str(data) {
        Ok(v) => v,
        Err(_) => return "[]".into(),
    };
    let mut songs: Vec<Song> = Vec::new();
    if let Some(list) = parsed["data"]["result"].as_array() {
        for item in list {
            let bvid = item["bvid"].as_str().unwrap_or("").to_string();
            let title = item["title"].as_str()
                .unwrap_or("未知")
                .replace("<em class=\"keyword\">", "")
                .replace("</em>", "");
            let artist = item["author"].as_str().unwrap_or("未知").to_string();
            let cover_url = item["pic"].as_str().unwrap_or("").to_string();
            let duration_str = item["duration"].as_str().unwrap_or("0:00");
            let duration = parse_duration(duration_str);
            songs.push(Song {
                id: bvid,
                title,
                artist,
                album: String::new(),
                platform: "bilibili".into(),
                cover_url,
                audio_url: "".into(),
                lyric_url: "".into(),
                duration,
            });
        }
    }
    serde_json::to_string(&songs).unwrap()
}

fn parse_duration(s: &str) -> u64 {
    let parts: Vec<&str> = s.split(':').collect();
    if parts.len() == 2 {
        let min: u64 = parts[0].parse().unwrap_or(0);
        let sec: u64 = parts[1].parse().unwrap_or(0);
        min * 60 + sec
    } else {
        0
    }
}

// ─── Migu parsing ───

#[wasm_bindgen]
pub fn parse_migu_search(data: &str) -> String {
    let parsed: serde_json::Value = match serde_json::from_str(data) {
        Ok(v) => v,
        Err(_) => return "[]".into(),
    };
    let mut songs: Vec<Song> = Vec::new();
    if let Some(list) = parsed["musics"].as_array() {
        for item in list {
            let id = item["contentid"].as_str().unwrap_or("").to_string();
            let title = item["songname"].as_str().unwrap_or("未知").to_string();
            let artist = item["singer"].as_str().unwrap_or("未知").to_string();
            let album = item["album"].as_str().unwrap_or("").to_string();
            let cover_url = item["album_pic"].as_str().unwrap_or("").to_string();
            let duration = item["duration"].as_str().unwrap_or("0").parse().unwrap_or(0);
            songs.push(Song {
                id,
                title,
                artist,
                album,
                platform: "migu".into(),
                cover_url,
                audio_url: "".into(),
                lyric_url: "".into(),
                duration,
            });
        }
    }
    serde_json::to_string(&songs).unwrap()
}

// ─── Playlist management ───

#[wasm_bindgen]
pub struct Playlist {
    songs: Vec<Song>,
    current_index: usize,
}

#[wasm_bindgen]
impl Playlist {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Playlist {
        Playlist {
            songs: Vec::new(),
            current_index: 0,
        }
    }

    pub fn add_song(&mut self, song_json: &str) {
        if let Ok(song) = serde_json::from_str::<Song>(song_json) {
            self.songs.push(song);
        }
    }

    pub fn remove_song(&mut self, index: usize) {
        if index < self.songs.len() {
            self.songs.remove(index);
            if self.current_index >= self.songs.len() && self.current_index > 0 {
                self.current_index = self.songs.len() - 1;
            }
        }
    }

    pub fn clear(&mut self) {
        self.songs.clear();
        self.current_index = 0;
    }

    pub fn set_current_index(&mut self, index: usize) {
        if index < self.songs.len() {
            self.current_index = index;
        }
    }

    pub fn get_current_song(&self) -> String {
        if let Some(song) = self.songs.get(self.current_index) {
            serde_json::to_string(song).unwrap_or_default()
        } else {
            "null".into()
        }
    }

    pub fn get_all_songs(&self) -> String {
        serde_json::to_string(&self.songs).unwrap()
    }

    pub fn size(&self) -> usize {
        self.songs.len()
    }

    pub fn current_index(&self) -> usize {
        self.current_index
    }
}

// ─── Utility functions ───

#[wasm_bindgen]
pub fn format_duration(seconds: u64) -> String {
    let mins = seconds / 60;
    let secs = seconds % 60;
    format!("{:02}:{:02}", mins, secs)
}

#[wasm_bindgen]
pub fn escape_html(input: &str) -> String {
    input
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

#[wasm_bindgen]
pub fn version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}
