
import React, { useState, useEffect, useCallback } from 'react';
import { User, Store } from './types';
import { getDB, saveDB, notifyDBSync } from './db';
import MerchantApp from './components/MerchantApp';
import StudentApp from './components/StudentApp';
import LoginWindow from './components/LoginWindow';

interface WindowInstance {
  id: string;
  type: 'LOGIN' | 'MERCHANT' | 'STUDENT';
  title: string;
  user?: User;
  x: number;
  y: number;
  isFocused: boolean;
}

const App: React.FC = () => {
  const [windows, setWindows] = useState<WindowInstance[]>([]);

  // Initialize with a login window
  useEffect(() => {
    const firstId = Math.random().toString(36).substring(7);
    setWindows([
      {
        id: firstId,
        type: 'LOGIN',
        title: '系统登录 - 窗口 A',
        x: 60,
        y: 60,
        isFocused: true
      }
    ]);
  }, []);

  // Heartbeat for Active Sessions to satisfy model requirements
  useEffect(() => {
    const interval = setInterval(() => {
      const db = getDB();
      const now = Date.now();
      const myWindowIds = windows.map(w => w.id);
      
      const otherSessions = db.sessions.filter(s => !myWindowIds.includes(s.windowId) && s.lastHeartbeat > now - 15000);
      const mySessions = myWindowIds.map(id => ({ windowId: id, lastHeartbeat: now }));
      
      db.sessions = [...otherSessions, ...mySessions];
      saveDB(db);
    }, 5000);
    return () => clearInterval(interval);
  }, [windows]);

  const launchWindow = (type: 'LOGIN' | 'MERCHANT' | 'STUDENT', user?: User) => {
    const id = Math.random().toString(36).substring(7);
    const count = windows.length;
    const offset = (count % 10) * 30;
    setWindows(prev => [
      ...prev.map(w => ({ ...w, isFocused: false })),
      {
        id,
        type,
        title: `${type === 'LOGIN' ? '系统登录' : type === 'MERCHANT' ? '商家管理' : '校内点餐'} - ${user?.username || '新实例'}`,
        user,
        x: 100 + offset,
        y: 80 + offset,
        isFocused: true
      }
    ]);
  };

  const closeWindow = (id: string) => {
    setWindows(prev => prev.filter(w => w.id !== id));
  };

  const focusWindow = (id: string) => {
    setWindows(prev => prev.map(w => ({
      ...w,
      isFocused: w.id === id
    })));
  };

  const handleLoginSuccess = (windowId: string, user: User) => {
    setWindows(prev => prev.map(w => {
      if (w.id === windowId) {
        return {
          ...w,
          type: user.isMerchant ? 'MERCHANT' : 'STUDENT',
          title: `${user.isMerchant ? '商家管理' : '校内点餐'} - ${user.username}`,
          user
        };
      }
      return w;
    }));
  };

  return (
    <div className="relative h-screen w-screen bg-[#1a1a1a] overflow-hidden">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1541339907198-e08756ebafe3?q=80&w=2070')] bg-cover bg-center">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"></div>
      </div>

      {/* Desktop Icons */}
      <div className="absolute top-8 left-8 flex flex-col gap-10 z-0">
        <div 
          onClick={() => launchWindow('LOGIN')}
          className="flex flex-col items-center gap-3 cursor-pointer group select-none"
        >
          <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center text-white text-3xl shadow-[0_8px_20px_rgba(59,130,246,0.4)] group-hover:scale-110 group-active:scale-95 transition-all">
            <i className="fa-solid fa-plus"></i>
          </div>
          <span className="text-white text-sm font-bold drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">新建登录窗口</span>
        </div>
        <div className="flex flex-col items-center gap-3 opacity-50 cursor-default select-none">
          <div className="w-16 h-16 bg-white/10 border border-white/20 rounded-2xl flex items-center justify-center text-white text-3xl">
            <i className="fa-solid fa-database"></i>
          </div>
          <span className="text-white text-xs font-medium drop-shadow-md">本地数据库</span>
        </div>
      </div>

      {/* Windows Layer */}
      {windows.map((win) => (
        <div
          key={win.id}
          onClick={() => focusWindow(win.id)}
          className={`absolute rounded-xl overflow-hidden flex flex-col window-shadow bg-gray-50 transition-shadow ${win.isFocused ? 'z-40 ring-2 ring-blue-500/50' : 'z-10 shadow-lg opacity-95'}`}
          style={{ 
            left: win.x, 
            top: win.y, 
            width: win.type === 'LOGIN' ? '400px' : '960px', 
            height: win.type === 'LOGIN' ? '520px' : 'min(720px, 90vh)',
          }}
        >
          {/* Title Bar - Windows Style */}
          <div className={`h-10 flex items-center justify-between select-none shrink-0 ${win.isFocused ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600 border-b border-gray-300'}`}>
            <div className="flex items-center gap-3 px-4 overflow-hidden">
              <i className={`fa-solid ${win.type === 'LOGIN' ? 'fa-user-shield' : win.type === 'MERCHANT' ? 'fa-store' : 'fa-graduation-cap'} text-xs`}></i>
              <span className="text-[13px] font-bold truncate tracking-tight">{win.title}</span>
            </div>
            <div className="flex items-center h-full">
              <button onClick={(e) => { e.stopPropagation(); }} className="w-12 h-full hover:bg-white/10 flex items-center justify-center transition-colors">
                <i className="fa-solid fa-minus text-[10px]"></i>
              </button>
              <button onClick={(e) => { e.stopPropagation(); closeWindow(win.id); }} className="w-12 h-full hover:bg-[#e81123] hover:text-white flex items-center justify-center transition-colors">
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>
          </div>

          {/* App Content Area */}
          <div className="flex-1 overflow-hidden bg-white relative">
            {win.type === 'LOGIN' && (
              <LoginWindow onLogin={(user) => handleLoginSuccess(win.id, user)} />
            )}
            {win.type === 'MERCHANT' && win.user && (
              <MerchantApp user={win.user} />
            )}
            {win.type === 'STUDENT' && win.user && (
              <StudentApp user={win.user} />
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default App;
