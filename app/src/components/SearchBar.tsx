'use client';

import React, { useState, useEffect } from 'react';
import { Search, Globe, ChevronDown } from 'lucide-react';
import { useTranslation } from './I18nProvider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

const searchEngines = [
  {
    name: 'Google',
    url: 'https://www.google.com/search?q=',
    icon: 'https://www.google.com/favicon.ico',
    color: 'from-blue-500 via-red-500 to-yellow-500',
  },
  {
    name: 'Bing',
    url: 'https://www.bing.com/search?q=',
    icon: 'https://cn.bing.com/sa/simg/favicon-2x.ico',
    color: 'from-cyan-500 to-blue-600',
  },
  {
    name: 'Baidu',
    url: 'https://www.baidu.com/s?wd=',
    icon: 'https://www.baidu.com/favicon.ico',
    color: 'from-blue-600 to-blue-800',
  },
  {
    name: 'GitHub',
    url: 'https://github.com/search?q=',
    icon: 'https://github.com/favicon.ico',
    color: 'from-zinc-700 to-zinc-900',
  },
];

interface SearchBarProps {
  onLocalSearch: (query: string) => void;
}

export default function SearchBar({ onLocalSearch }: SearchBarProps) {
  const { t } = useTranslation();
  const [selectedEngine, setSelectedEngine] = useState(searchEngines[0]);
  const [query, setQuery] = useState('');

  // 挂载时尝试从 localStorage 恢复用户首选搜索引擎
  useEffect(() => {
    const saved = localStorage.getItem('search_engine');
    if (saved) {
      const match = searchEngines.find((se) => se.name === saved);
      if (match) setSelectedEngine(match);
    }
  }, []);

  const handleSelectEngine = (engine: typeof searchEngines[0]) => {
    setSelectedEngine(engine);
    localStorage.setItem('search_engine', engine.name);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    window.open(`${selectedEngine.url}${encodeURIComponent(query)}`, '_blank');
  };

  const handleInputChange = (val: string) => {
    setQuery(val);
    onLocalSearch(val);
  };

  return (
    <form
      onSubmit={handleSearch}
      className="w-full max-w-[640px] mx-auto z-10 duration-500 animate-fade-in"
    >
      <div className="relative flex items-center bg-white/5 border border-white/5 hover:border-white/10 focus-within:border-indigo-500/30 rounded-2xl shadow-xl backdrop-blur-xl px-2 py-1.5 transition-all">
        {/* 搜索引擎下拉选择 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition text-sm text-white/80 select-none cursor-pointer"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedEngine.icon}
                alt={selectedEngine.name}
                onError={(e) => {
                  // 兜底图标
                  (e.target as HTMLElement).style.display = 'none';
                }}
                className="w-4 h-4 rounded-sm object-contain"
              />
              <span className="font-heading font-medium text-xs hidden sm:inline">
                {selectedEngine.name}
              </span>
              <ChevronDown size={12} className="text-white/40" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="bg-[#12131a]/95 border-white/5 text-white/80 p-1 rounded-xl">
            {searchEngines.map((engine) => (
              <DropdownMenuItem
                key={engine.name}
                onClick={() => handleSelectEngine(engine)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 cursor-pointer text-xs"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={engine.icon}
                  alt={engine.name}
                  className="w-4 h-4 rounded-sm object-contain"
                />
                <span>{engine.name}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* 搜索框 */}
        <input
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder={t.searchPlaceholder}
          className="w-full bg-transparent border-none outline-none text-white text-sm px-4 py-2 placeholder-white/30"
        />

        {/* 搜索图标/确认按钮 */}
        <button
          type="submit"
          className="flex items-center justify-center p-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white transition active:scale-95 shadow-md shadow-indigo-500/20 cursor-pointer"
        >
          <Search size={16} />
        </button>
      </div>
    </form>
  );
}
