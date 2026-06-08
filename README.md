# 🎵 顶点音乐 DD Music

基于 **WebAssembly (Rust)** 和 **Cloudflare Pages** 的多平台聚合音乐播放器。

支持六大音乐平台搜索与播放：网易云音乐、QQ音乐、酷狗、酷我、哔哩哔哩、咪咕音乐。

## 技术栈

- **Rust → WASM** — 核心搜索解析、歌单管理、音频工具
- **Cloudflare Pages Functions** — API 代理，解决跨域问题
- **原生 HTML/CSS/JS** — 现代化暗色主题音乐播放器 UI

## 快速开始

### 前置要求

- Rust 工具链 (`rustup`)
- wasm-pack (`curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh`)

### 本地构建

```bash
# 构建 WASM 模块
wasm-pack build --target web --out-dir docs/pkg

# 本地预览
cd docs && python3 -m http.server 8000
```

### 部署到 Cloudflare Pages

```bash
# 安装 wrangler
npm install -g wrangler

# 构建并部署
wasm-pack build --target web --out-dir docs/pkg
wrangler pages deploy docs --project-name=dd-music
```

Cloudflare Pages Functions 会自动处理 `/api/proxy` 路由，代理音乐平台 API 请求。

## 部署地址

- **GitHub Pages**: https://chengshiluan.github.io/dd-music-wasm/
- **推荐使用 Cloudflare Pages** 以获得完整 API 代理功能

## 项目结构

```
├── src/lib.rs              # Rust WASM 核心模块
├── docs/                   # 前端静态文件 + Cloudflare Functions
│   ├── index.html          # 播放器主页面
│   ├── css/style.css       # 样式
│   ├── js/app.js           # 播放器逻辑
│   ├── pkg/                # 编译后的 WASM 模块
│   └── functions/api/      # Cloudflare Pages Functions (API 代理)
├── Cargo.toml              # Rust 项目配置
└── wrangler.toml           # Cloudflare Pages 配置
```

## License

MIT
