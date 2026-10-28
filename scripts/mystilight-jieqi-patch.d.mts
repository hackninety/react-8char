import type { Plugin as EsbuildPlugin } from 'esbuild';
import type { Plugin as VitePlugin } from 'vite';

export const JIEQI_SHIFT_KEY: string;
export const OBSERVATION_TIME_KEY: string;
export const MYSTILIGHT_FILE: RegExp;
export function patchMystilight(code: string): string;
export function mystilightEsbuildPlugin(): EsbuildPlugin;
export function mystilightVitePlugin(): VitePlugin;
