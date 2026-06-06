import { useState } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { Globe, Check, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function LanguageSelector() {
  const { lang, setLang } = useLanguage();

  const languages = [
    { code: 'en', label: 'English', flag: '🇺🇸' },
    { code: 'ar', label: 'العربية', flag: '🇱🇧' }
  ];

  const currentLang = languages.find(l => l.code === lang) || languages[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-muted-foreground hover:text-white group">
          <Globe className="w-4 h-4 group-hover:rotate-12 transition-transform" />
          <span className="text-xs font-black uppercase tracking-widest hidden sm:inline">{currentLang.code}</span>
          <ChevronDown className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="glass border-white/10 p-2 min-w-[140px] rounded-2xl animate-in slide-in-from-top-2 duration-300">
        {languages.map((l) => (
          <DropdownMenuItem
            key={l.code}
            onClick={() => setLang(l.code as any)}
            className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
              lang === l.code ? 'bg-primary/20 text-white font-black' : 'hover:bg-white/5 text-muted-foreground'
            }`}
          >
            <div className="flex items-center gap-3">
               <span className="text-lg">{l.flag}</span>
               <span className="text-xs uppercase tracking-widest font-black">{l.label}</span>
            </div>
            {lang === l.code && <Check className="w-4 h-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
