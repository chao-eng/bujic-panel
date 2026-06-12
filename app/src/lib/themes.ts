// 主题定义
export type ThemeId =
  | 'blueprint'
  | 'blueprint-light'
  | 'cosmos'
  | 'ember'
  | 'aurora'
  | 'sakura'
  | 'arctic'
  | 'cosmos-light'
  | 'ember-light'
  | 'aurora-light'
  | 'sakura-light'
  | 'arctic-light';

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
    id: 'blueprint',
    label: '午夜蓝图 (深色)',
    labelEn: 'Midnight Blueprint (Dark)',
    primary: '#E5FF00',
    bg: '#0B0E14',
    description: '午夜深蓝，酸性黄点缀，极客工业感',
  },
  {
    id: 'blueprint-light',
    label: '晴空蓝图 (浅色)',
    labelEn: 'Sky Blueprint (Light)',
    primary: '#0055FF',
    bg: '#E8E4DF',
    description: '工程图纸，骨白与深蓝，理性主义',
  },
  {
    id: 'cosmos',
    label: '宇宙 (深色)',
    labelEn: 'Cosmos (Dark)',
    primary: '#6366f1',
    bg: '#0a0b13',
    description: '深空蓝紫，神秘而宁静',
  },
  {
    id: 'ember',
    label: '炽焰 (深色)',
    labelEn: 'Ember (Dark)',
    primary: '#f97316',
    bg: '#110a05',
    description: '炽热橙红，温暖而热烈',
  },
  {
    id: 'aurora',
    label: '极光 (深色)',
    labelEn: 'Aurora (Dark)',
    primary: '#10b981',
    bg: '#050f0a',
    description: '翡翠碧绿，清新而生机',
  },
  {
    id: 'sakura',
    label: '樱花 (深色)',
    labelEn: 'Sakura (Dark)',
    primary: '#ec4899',
    bg: '#10050c',
    description: '玫瑰粉红，浪漫而优雅',
  },
  {
    id: 'arctic',
    label: '冰川 (深色)',
    labelEn: 'Arctic (Dark)',
    primary: '#06b6d4',
    bg: '#050c11',
    description: '冰晶青蓝，清冽而通透',
  },
  {
    id: 'cosmos-light',
    label: '晴空 (浅色)',
    labelEn: 'Sky (Light)',
    primary: '#6366f1',
    bg: '#f8fafc',
    description: '晴空蔚蓝，明亮而通透',
  },
  {
    id: 'ember-light',
    label: '暖阳 (浅色)',
    labelEn: 'Warm Sun (Light)',
    primary: '#f97316',
    bg: '#fff7ed',
    description: '午后暖阳，温馨而惬意',
  },
  {
    id: 'aurora-light',
    label: '青草 (浅色)',
    labelEn: 'Meadow (Light)',
    primary: '#10b981',
    bg: '#f0fdf4',
    description: '春日青草，清新而自然',
  },
  {
    id: 'sakura-light',
    label: '落樱 (浅色)',
    labelEn: 'Blossom (Light)',
    primary: '#ec4899',
    bg: '#fdf2f8',
    description: '落樱缤纷，温柔而甜美',
  },
  {
    id: 'arctic-light',
    label: '冰川 (浅色)',
    labelEn: 'Glacier (Light)',
    primary: '#06b6d4',
    bg: '#ecfeff',
    description: '极地冰川，纯净而清爽',
  },
];

export const DEFAULT_THEME: ThemeId = 'blueprint';
export const THEME_STORAGE_KEY = 'bujic-theme';
