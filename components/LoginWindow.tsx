
import React, { useState } from 'react';
import { User } from '../types';
import { getDB, saveDB, findUser } from '../db';

interface LoginWindowProps {
  onLogin: (user: User) => void;
}

const LoginWindow: React.FC<LoginWindowProps> = ({ onLogin }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isMerchant, setIsMerchant] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (isRegister) {
      if (findUser(username)) {
        setError('用户名已存在');
        return;
      }
      const newUser: User = {
        id: Math.random().toString(36).substring(7),
        username,
        passwordHash: password, // In real app, use bcrypt
        isMerchant
      };
      const db = getDB();
      db.users.push(newUser);
      saveDB(db);
      onLogin(newUser);
    } else {
      const user = findUser(username);
      if (user && user.passwordHash === password) {
        onLogin(user);
      } else {
        setError('用户名或密码错误');
      }
    }
  };

  return (
    <div className="p-8 flex flex-col items-center justify-center h-full">
      <div className="w-full max-w-xs">
        <div className="text-center mb-8">
          <div className="inline-block p-5 rounded-full bg-blue-100 text-blue-600 mb-4 shadow-inner">
            <i className="fa-solid fa-building-columns fa-3x"></i>
          </div>
          <h2 className="text-2xl font-black text-gray-800 tracking-tight">校园点餐监测系统</h2>
          <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mt-1">Local Security Node</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">用户名</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 border border-gray-100 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
              placeholder="请输入账号"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">密码</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-100 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
              placeholder="请输入密码"
            />
          </div>

          {isRegister && (
            <div className="flex items-center gap-3 py-2 px-1">
              <input
                type="checkbox"
                id="isMerchant"
                checked={isMerchant}
                onChange={(e) => setIsMerchant(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded-lg cursor-pointer"
              />
              <label htmlFor="isMerchant" className="text-xs font-bold text-gray-600 cursor-pointer">开通商家管理权限</label>
            </div>
          )}

          {error && <p className="text-red-500 text-xs font-bold text-center animate-shake">{error}</p>}

          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-4 rounded-xl font-black shadow-lg shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all"
          >
            {isRegister ? '立 即 注 册' : '登 录 系 统'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button
            onClick={() => setIsRegister(!isRegister)}
            className="text-blue-600 text-xs font-bold hover:underline"
          >
            {isRegister ? '已有账号？返回登录' : '没有账号？立即注册新节点'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginWindow;
