// 主题定义
export type ThemeId = 'cosmos' | 'ember' | 'aurora' | 'sakura' | 'arctic';

export interface ThemeDef {
  id: ThemeId;
  label: string;
  labelEn: string;
  primary: string;    // 用于 UI 预览色块
  bg: string;         // 用于 UI 预览背景
  description: string;
}

export const THEMES: ThemeDef[] = [
  {
    id: 'cosmos',
    label: '宇宙',
    labelEn: 'Cosmos',
    primary: '#6366f1',
    bg: '#0a0b13',
    description: '深空蓝紫，神秘而宁静',
  },
  {
    id: 'ember',
    label: '炽焰',
    labelEn: 'Ember',
    primary: '#f97316',
    bg: '#110a05',
    description: '炽热橙红，温暖而热烈',
  },
  {
    id: 'aurora',
    label: '极光',
    labelEn: 'Aurora',
    primary: '#10b981',
    bg: '#050f0a',
    description: '翡翠碧绿，清新而生机',
  },
  {
    id: 'sakura',
    label: '樱花',
    labelEn: 'Sakura',
    primary: '#ec4899',
    bg: '#10050c',
    description: '玫瑰粉红，浪漫而优雅',
  },
  {
    id: 'arctic',
    label: '冰川',
    labelEn: 'Arctic',
    primary: '#06b6d4',
    bg: '#050c11',
    description: '冰晶青蓝，清冽而通透',
  },
];

export const DEFAULT_THEME: ThemeId = 'cosmos';
export const THEME_STORAGE_KEY = 'bujic-theme';
