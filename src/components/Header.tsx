import { useState } from 'react';
import { AppScreen } from '../types';

interface HeaderProps {
  currentScreen: AppScreen;
  onSelectScreen: (screen: AppScreen) => void;
  unreadAlertsCount?: number;
}

export function Header({ currentScreen, onSelectScreen, unreadAlertsCount = 0 }: HeaderProps) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[#2f3543]/60 bg-[#080e1b]/95 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-md items-center justify-between px-4 sm:max-w-5xl sm:px-6">
        <button onClick={() => onSelectScreen('citizen-portal')} className="flex items-center gap-2 text-left" aria-label="Open emergency home">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ff5451] text-white"><span className="material-symbols-outlined">shield</span></span>
          <span>
            <span className="block text-base font-extrabold tracking-tight">DisasterLink</span>
            <span className="block font-mono text-[9px] uppercase tracking-[.14em] text-[#ffb3ad]">Emergency support</span>
          </span>
        </button>

        <div className="flex items-center gap-2">
          {currentScreen === 'citizen-portal' && <span className="hidden rounded-full bg-[#1a1f2d] px-2.5 py-1 font-mono text-[10px] text-[#adc6ff] sm:block">LOCATION READY</span>}
          <button onClick={() => setShowMenu((open) => !open)} aria-expanded={showMenu} aria-label="Open navigation" className="relative flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[#2f3543] bg-[#161b29]">
            <span className="material-symbols-outlined">{showMenu ? 'close' : 'menu'}</span>
            {unreadAlertsCount > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#ff5451]" />}
          </button>
        </div>
      </div>

      {showMenu && (
        <nav className="border-t border-[#2f3543]/60 bg-[#161b29] p-3 sm:absolute sm:right-6 sm:top-full sm:w-72 sm:rounded-b-2xl sm:border">
          <button onClick={() => { onSelectScreen('citizen-portal'); setShowMenu(false); }} className={`mb-2 flex w-full min-h-12 items-center gap-3 rounded-xl px-3 text-left text-sm font-bold ${currentScreen === 'citizen-portal' ? 'bg-[#0566d9] text-white' : 'bg-[#242a38] text-[#dde2f5]'}`}>
            <span className="material-symbols-outlined">emergency</span> Emergency help
          </button>
          <button onClick={() => { onSelectScreen('operator-command'); setShowMenu(false); }} className={`flex w-full min-h-12 items-center gap-3 rounded-xl px-3 text-left text-sm font-bold ${currentScreen === 'operator-command' ? 'bg-[#0566d9] text-white' : 'bg-[#242a38] text-[#dde2f5]'}`}>
            <span className="material-symbols-outlined">monitoring</span> Operator dashboard
          </button>
        </nav>
      )}
    </header>
  );
}
