/* tslint:disable */
/* eslint-disable */

export class Playlist {
    free(): void;
    [Symbol.dispose](): void;
    add_song(song_json: string): void;
    clear(): void;
    current_index(): number;
    get_all_songs(): string;
    get_current_song(): string;
    constructor();
    remove_song(index: number): void;
    set_current_index(index: number): void;
    size(): number;
}

export function build_netease_lyric_url(song_id: string): string;

export function build_netease_song_url(song_id: string): string;

export function escape_html(input: string): string;

export function format_duration(seconds: bigint): string;

export function get_platforms(): string;

export function parse_bilibili_popular(data: string): string;

export function parse_bilibili_search(data: string): string;

export function parse_kugou_chart(data: string): string;

export function parse_kugou_search(data: string): string;

export function parse_kuwo_search(data: string): string;

export function parse_migu_search(data: string): string;

export function parse_netease_chart(data: string): string;

export function parse_netease_playlist(data: string): string;

export function parse_netease_search(data: string): string;

export function parse_qq_chart(data: string): string;

export function parse_qq_search(data: string): string;

export function version(): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_playlist_free: (a: number, b: number) => void;
    readonly build_netease_lyric_url: (a: number, b: number) => [number, number];
    readonly build_netease_song_url: (a: number, b: number) => [number, number];
    readonly escape_html: (a: number, b: number) => [number, number];
    readonly format_duration: (a: bigint) => [number, number];
    readonly get_platforms: () => [number, number];
    readonly parse_bilibili_popular: (a: number, b: number) => [number, number];
    readonly parse_bilibili_search: (a: number, b: number) => [number, number];
    readonly parse_kugou_chart: (a: number, b: number) => [number, number];
    readonly parse_kuwo_search: (a: number, b: number) => [number, number];
    readonly parse_migu_search: (a: number, b: number) => [number, number];
    readonly parse_netease_chart: (a: number, b: number) => [number, number];
    readonly parse_netease_search: (a: number, b: number) => [number, number];
    readonly parse_qq_chart: (a: number, b: number) => [number, number];
    readonly parse_qq_search: (a: number, b: number) => [number, number];
    readonly playlist_add_song: (a: number, b: number, c: number) => void;
    readonly playlist_clear: (a: number) => void;
    readonly playlist_current_index: (a: number) => number;
    readonly playlist_get_all_songs: (a: number) => [number, number];
    readonly playlist_get_current_song: (a: number) => [number, number];
    readonly playlist_new: () => number;
    readonly playlist_remove_song: (a: number, b: number) => void;
    readonly playlist_set_current_index: (a: number, b: number) => void;
    readonly playlist_size: (a: number) => number;
    readonly version: () => [number, number];
    readonly parse_kugou_search: (a: number, b: number) => [number, number];
    readonly parse_netease_playlist: (a: number, b: number) => [number, number];
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
