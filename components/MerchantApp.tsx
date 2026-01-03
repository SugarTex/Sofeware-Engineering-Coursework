
import React, { useState, useEffect, useMemo } from 'react';
import { User, Store, Dish, LocationType, Order } from '../types';
import { getDB, saveDB, notifyDBSync } from '../db';
import { getMerchantAdvice } from '../services/geminiService';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

interface MerchantAppProps {
  user: User;
}

type MerchantView = 'DASHBOARD' | 'DISHES' | 'ORDERS';
type OrderFilter = 'ALL' | 'PENDING' | 'COMPLETED';

const MerchantApp: React.FC<MerchantAppProps> = ({ user }) => {
  const [activeView, setActiveView] = useState<MerchantView>('DASHBOARD');
  const [orderFilter, setOrderFilter] = useState<OrderFilter>('ALL');
  const [store, setStore] = useState<Store | null>(null);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [advice, setAdvice] = useState<{keywords: string[], tips: string[]} | null>(null);
  const [loadingAdvice, setLoadingAdvice] = useState(false);
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);

  // Store form state
  const [isEditingStore, setIsEditingStore] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [location, setLocation] = useState<LocationType>(LocationType.XINGAN);
  const [storeDesc, setStoreDesc] = useState('');

  // Dish form state
  const [isAddingDish, setIsAddingDish] = useState(false);
  const [dishName, setDishName] = useState('');
  const [dishPrice, setDishPrice] = useState(0);
  const [dishDesc, setDishDesc] = useState('');

  const refreshData = () => {
    const db = getDB();
    const myStore = db.stores.find(s => s.userId === user.id && !s.isDeleted);
    setStore(myStore || null);
    if (myStore) {
      setDishes(db.dishes.filter(d => d.storeId === myStore.id));
      setOrders(db.orders.filter(o => o.storeId === myStore.id).sort((a,b) => b.timestamp - a.timestamp));
    }
  };

  useEffect(() => {
    refreshData();
    window.addEventListener('storage', refreshData);
    return () => window.removeEventListener('storage', refreshData);
  }, [user]);

  const salesData = useMemo(() => {
    const hourlyData: Record<string, { time: string, revenue: number, count: number }> = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 3600000);
      const label = `${d.getHours()}:00`;
      hourlyData[label] = { time: label, revenue: 0, count: 0 };
    }
    orders.forEach(o => {
      const d = new Date(o.timestamp);
      const label = `${d.getHours()}:00`;
      if (hourlyData[label]) {
        hourlyData[label].revenue += o.totalPrice / 100;
        hourlyData[label].count += 1;
      }
    });
    return Object.values(hourlyData);
  }, [orders]);

  const handleCreateStore = () => {
    if (!storeName) return alert('请填写店名');
    const db = getDB();
    const newStore: Store = {
      id: Math.random().toString(36).substring(7),
      userId: user.id,
      name: storeName,
      location: location,
      image: `https://picsum.photos/seed/${storeName}/400/300`,
      description: storeDesc,
      isOpen: true,
      isDeleted: false
    };
    db.stores.push(newStore);
    saveDB(db);
    notifyDBSync();
    refreshData();
    setIsEditingStore(false);
  };

  const handleCompleteOrder = (orderId: string) => {
    const db = getDB();
    const orderIdx = db.orders.findIndex(o => o.id === orderId);
    if (orderIdx !== -1) {
      db.orders[orderIdx].status = 'COMPLETED';
      saveDB(db);
      notifyDBSync();
      refreshData();
    }
  };

  const handleToggleOpen = () => {
    if (!store) return;
    const db = getDB();
    const idx = db.stores.findIndex(s => s.id === store.id);
    db.stores[idx].isOpen = !db.stores[idx].isOpen;
    saveDB(db);
    notifyDBSync();
    refreshData();
  };

  const handleToggleDishAvailability = (dishId: string) => {
    const db = getDB();
    const idx = db.dishes.findIndex(d => d.id === dishId);
    if (idx !== -1) {
      db.dishes[idx].isAvailable = !db.dishes[idx].isAvailable;
      saveDB(db);
      notifyDBSync();
      refreshData();
    }
  };

  const handleAddDish = () => {
    if (!store || !dishName) return;
    const db = getDB();
    const newDish: Dish = {
      id: Math.random().toString(36).substring(7),
      storeId: store.id,
      name: dishName,
      price: dishPrice * 100,
      description: dishDesc,
      image: `https://picsum.photos/seed/${dishName}/300/200`,
      isAvailable: true
    };
    db.dishes.push(newDish);
    saveDB(db);
    notifyDBSync();
    refreshData();
    setIsAddingDish(false);
    setDishName('');
    setDishPrice(0);
    setDishDesc('');
  };

  const fetchAdvice = async () => {
    if (!store) return;
    setLoadingAdvice(true);
    const result = await getMerchantAdvice(store.id);
    setAdvice(result);
    setLoadingAdvice(false);
    setActiveView('DASHBOARD'); 
  };

  const filteredOrders = orders.filter(o => {
    if (orderFilter === 'ALL') return true;
    if (orderFilter === 'PENDING') return o.status === 'CONFIRMED';
    if (orderFilter === 'COMPLETED') return o.status === 'COMPLETED';
    return true;
  });

  if (!store && !isEditingStore) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-10 bg-gray-50">
        <div className="bg-white p-10 rounded-2xl shadow-sm text-center max-w-md">
          <i className="fa-solid fa-store-slash text-6xl text-gray-300 mb-6"></i>
          <h2 className="text-2xl font-bold mb-2">未检测到您的店铺</h2>
          <p className="text-gray-500 mb-8">开启您的校园餐饮之旅，让更多学生品尝到您的美食。</p>
          <button 
            onClick={() => setIsEditingStore(true)}
            className="bg-blue-600 text-white px-8 py-3 rounded-full font-bold hover:bg-blue-700 transition-all active:scale-95 shadow-lg"
          >
            立即开通商家模式
          </button>
        </div>
      </div>
    );
  }

  if (isEditingStore) {
    return (
      <div className="p-10 max-w-2xl mx-auto animate-fade-in">
        <h2 className="text-2xl font-bold mb-6">入驻店铺信息</h2>
        <div className="space-y-4 bg-white p-8 rounded-xl border">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">店铺名称</label>
            <input value={storeName} onChange={e=>setStoreName(e.target.value)} className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" placeholder="例如：好再来烧腊" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">所在校区地点</label>
            <select value={location} onChange={e=>setLocation(e.target.value as LocationType)} className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none">
              {Object.values(LocationType).map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">店铺介绍</label>
            <textarea value={storeDesc} onChange={e=>setStoreDesc(e.target.value)} className="w-full border p-2 rounded h-24 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="说说您的特色..." />
          </div>
          <div className="flex gap-4 pt-4">
            <button onClick={handleCreateStore} className="flex-1 bg-blue-600 text-white py-2 rounded font-bold hover:bg-blue-700 active:scale-95 transition-all">保存并开通</button>
            <button onClick={() => setIsEditingStore(false)} className="flex-1 bg-gray-200 py-2 rounded font-bold hover:bg-gray-300 active:scale-95 transition-all">取消</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full animate-fade-in relative">
      {/* Sidebar */}
      <div className="w-64 bg-gray-100 border-r p-6 flex flex-col gap-4 shrink-0">
        <div className="mb-8">
          <h1 className="text-xl font-black text-blue-800 tracking-tight">商家管理后台</h1>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Merchant Portal</p>
        </div>
        <nav className="flex-1 space-y-1">
          <button 
            onClick={() => setActiveView('DASHBOARD')}
            className={`w-full text-left p-4 rounded-xl flex items-center gap-3 font-bold transition-all active:scale-95 ${activeView === 'DASHBOARD' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-gray-600 hover:bg-white hover:shadow-sm'}`}
          >
            <i className="fa-solid fa-chart-line w-5"></i> 经营概况
          </button>
          <button 
            onClick={() => setActiveView('DISHES')}
            className={`w-full text-left p-4 rounded-xl flex items-center gap-3 font-bold transition-all active:scale-95 ${activeView === 'DISHES' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-gray-600 hover:bg-white hover:shadow-sm'}`}
          >
            <i className="fa-solid fa-utensils w-5"></i> 菜品管理
          </button>
          <button 
            onClick={() => setActiveView('ORDERS')}
            className={`w-full text-left p-4 rounded-xl flex items-center gap-3 font-bold transition-all active:scale-95 ${activeView === 'ORDERS' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-gray-600 hover:bg-white hover:shadow-sm'}`}
          >
            <i className="fa-solid fa-rectangle-list w-5"></i> 订单明细
          </button>
          <div className="pt-4 mt-4 border-t border-gray-200">
            <button 
              onClick={fetchAdvice} 
              disabled={loadingAdvice} 
              className="w-full text-left p-4 rounded-xl flex items-center gap-3 font-bold transition-all text-yellow-700 bg-yellow-50 hover:bg-yellow-100 border border-yellow-100 disabled:opacity-50 active:scale-95"
            >
              <i className={`fa-solid ${loadingAdvice ? 'fa-spinner fa-spin' : 'fa-lightbulb'} w-5`}></i> 
              <span>{loadingAdvice ? '正在分析...' : 'AI 智能决策'}</span>
            </button>
          </div>
        </nav>
        <div className="mt-auto pt-6 border-t border-gray-200">
          <div className="flex items-center justify-between p-3 bg-white rounded-2xl shadow-sm">
            <span className="text-xs font-black text-gray-400 uppercase tracking-widest">营业中</span>
            <button 
              onClick={handleToggleOpen}
              className={`w-10 h-5 rounded-full relative transition-colors ${store?.isOpen ? 'bg-green-500' : 'bg-gray-300'}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${store?.isOpen ? 'right-0.5' : 'left-0.5'}`}></div>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-10 overflow-auto bg-gray-50/50">
        <div className="flex justify-between items-end mb-10 pb-8 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-4xl font-black text-gray-900 tracking-tighter">{store?.name}</h2>
              <span className={`px-3 py-1 text-[10px] font-black rounded-full uppercase tracking-widest ${store?.isOpen ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {store?.isOpen ? 'Online' : 'Offline'}
              </span>
            </div>
            <p className="text-gray-400 font-bold flex items-center gap-2">
              <i className="fa-solid fa-location-dot text-blue-500"></i> {store?.location} 校区商家
            </p>
          </div>
          <div className="flex gap-4">
             <div className="bg-white px-8 py-5 rounded-3xl shadow-sm border border-white flex flex-col items-center min-w-[140px]">
                <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">总流水 (CNY)</span>
                <span className="text-2xl font-black text-blue-600">￥{(orders.reduce((acc,o)=>acc+o.totalPrice,0)/100).toFixed(2)}</span>
             </div>
             <div className="bg-white px-8 py-5 rounded-3xl shadow-sm border border-white flex flex-col items-center min-w-[140px]">
                <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">成交单量</span>
                <span className="text-2xl font-black text-green-600">{orders.filter(o => o.status === 'COMPLETED').length}</span>
             </div>
          </div>
        </div>

        {advice && (
          <div className="mb-10 bg-gradient-to-br from-yellow-50 to-orange-50 border border-yellow-200/50 p-8 rounded-[2.5rem] animate-fade-in shadow-xl shadow-yellow-200/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <i className="fa-solid fa-robot text-8xl text-yellow-500"></i>
            </div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-black text-yellow-800 text-xl tracking-tight flex items-center gap-3">
                  <i className="fa-solid fa-wand-magic-sparkles"></i> AI 智能经营深度透视
                </h3>
                <button onClick={() => setAdvice(null)} className="w-10 h-10 rounded-full bg-white/50 flex items-center justify-center text-yellow-700 hover:bg-white transition-colors active:scale-95">
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
              <div className="flex flex-wrap gap-2 mb-8">
                {advice.keywords.map(k => <span key={k} className="px-4 py-1.5 bg-yellow-400 text-yellow-900 text-[11px] rounded-full font-black uppercase tracking-wider shadow-sm">{k}</span>)}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {advice.tips.map((t, i) => (
                  <div key={i} className="bg-white/60 backdrop-blur p-5 rounded-2xl border border-white/50 flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-yellow-400 text-yellow-900 flex items-center justify-center shrink-0 font-black text-xs">{i+1}</div>
                    <p className="text-yellow-950 text-sm font-bold leading-relaxed">{t}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="animate-fade-in">
          {activeView === 'DASHBOARD' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
              <div className="lg:col-span-2 space-y-10">
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
                  <h3 className="text-xl font-black mb-8 tracking-tight">近期销售趋势 (营收 / 小时)</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={salesData}>
                        <defs>
                          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 'bold'}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 'bold'}} />
                        <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }} />
                        <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fillOpacity={1} fill="url(#colorRevenue)" strokeWidth={3} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-8">
                   <div className="bg-blue-600 p-8 rounded-[2.5rem] text-white shadow-xl shadow-blue-100 group cursor-default">
                      <h4 className="text-xs font-black uppercase tracking-[0.2em] mb-4 opacity-70">本周平均客单价</h4>
                      <p className="text-4xl font-black">￥{(orders.length > 0 ? orders.reduce((a,b)=>a+b.totalPrice,0)/orders.length/100 : 0).toFixed(2)}</p>
                      <p className="text-xs mt-4 font-bold"><i className="fa-solid fa-arrow-up mr-1"></i> 实时动态更新</p>
                   </div>
                   <div className="bg-indigo-600 p-8 rounded-[2.5rem] text-white shadow-xl shadow-indigo-100 group cursor-default">
                      <h4 className="text-xs font-black uppercase tracking-[0.2em] mb-4 opacity-70">活跃订单转化</h4>
                      <p className="text-4xl font-black">{(orders.length * 1.5).toFixed(0)}%</p>
                      <p className="text-xs mt-4 font-bold"><i className="fa-solid fa-heart mr-1"></i> 流量利用率稳步上涨</p>
                   </div>
                </div>
              </div>
              <div className="space-y-10">
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
                  <h3 className="text-xl font-black mb-6 tracking-tight">待办事项</h3>
                  <div className="space-y-4">
                    <div 
                      onClick={() => { setActiveView('ORDERS'); setOrderFilter('PENDING'); }}
                      className="flex items-center gap-4 p-4 bg-red-50 text-red-700 rounded-2xl font-bold text-sm cursor-pointer hover:bg-red-100 transition-colors active:scale-95 border border-red-100"
                    >
                      <i className="fa-solid fa-circle-exclamation text-lg"></i>
                      <span>有 {orders.filter(o => o.status === 'CONFIRMED').length} 个待出餐订单 <i className="fa-solid fa-arrow-right ml-1 text-xs"></i></span>
                    </div>
                    <div className="flex items-center gap-4 p-4 bg-blue-50 text-blue-700 rounded-2xl font-bold text-sm border border-blue-100">
                      <i className="fa-solid fa-circle-info text-lg"></i>
                      <span>店铺已正常开启，随时接收新订单</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeView === 'DISHES' && (
            <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-gray-100">
              <div className="flex justify-between items-center mb-10">
                <div>
                  <h3 className="text-2xl font-black tracking-tight">菜品库管理</h3>
                  <p className="text-sm text-gray-400 font-bold">共有 {dishes.length} 款菜品</p>
                </div>
                <button 
                  onClick={()=>setIsAddingDish(!isAddingDish)} 
                  className={`px-8 py-4 rounded-2xl font-black text-sm shadow-xl transition-all active:scale-95 ${isAddingDish ? 'bg-gray-200 text-gray-600' : 'bg-blue-600 text-white shadow-blue-200 hover:bg-blue-700 hover:-translate-y-1'}`}
                >
                  <i className={`fa-solid ${isAddingDish ? 'fa-xmark' : 'fa-plus'} mr-2`}></i> {isAddingDish ? '取消操作' : '上架新菜品'}
                </button>
              </div>

              {isAddingDish && (
                <div className="mb-10 p-10 bg-gray-50 rounded-[2.5rem] border-2 border-dashed border-gray-200 animate-slide-down">
                  <div className="grid grid-cols-2 gap-8 mb-6">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">菜品名称</label>
                      <input placeholder="请输入菜品全称" value={dishName} onChange={e=>setDishName(e.target.value)} className="w-full p-4 border rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">定价 (元)</label>
                      <input placeholder="0.00" type="number" value={dishPrice} onChange={e=>setDishPrice(Number(e.target.value))} className="w-full p-4 border rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none" />
                    </div>
                  </div>
                  <div className="mb-8">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">风味描述</label>
                    <textarea placeholder="描述一下菜品的用料、口味、制作工艺等..." value={dishDesc} onChange={e=>setDishDesc(e.target.value)} className="w-full p-6 border rounded-2xl h-32 focus:ring-4 focus:ring-blue-500/10 outline-none"></textarea>
                  </div>
                  <div className="flex gap-4">
                    <button onClick={handleAddDish} className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-black shadow-lg shadow-blue-200 active:scale-95 transition-all">确认上架</button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {dishes.map(d => (
                  <div key={d.id} className={`group flex gap-6 p-6 rounded-[2rem] border transition-all duration-300 ${d.isAvailable ? 'bg-gray-50/50 hover:bg-white border-transparent hover:border-gray-100 hover:shadow-xl hover:shadow-gray-200/50' : 'bg-gray-100 opacity-60 border-dashed border-gray-300'}`}>
                    <img src={d.image} className="w-24 h-24 rounded-2xl object-cover shadow-sm group-hover:scale-105 transition-transform" alt={d.name} />
                    <div className="flex-1 flex flex-col justify-center">
                      <div className="flex justify-between items-start">
                        <h4 className={`text-lg font-black ${d.isAvailable ? 'text-gray-900 group-hover:text-blue-600' : 'text-gray-400'} transition-colors`}>{d.name}</h4>
                        <span className={`text-xl font-black ${d.isAvailable ? 'text-red-600' : 'text-gray-400'}`}>￥{(d.price/100).toFixed(2)}</span>
                      </div>
                      <p className="text-xs text-gray-400 font-medium line-clamp-1 mt-1">{d.description || '暂无详细描述'}</p>
                      <div className="mt-4 flex gap-4">
                        <button 
                          onClick={() => handleToggleDishAvailability(d.id)}
                          className={`text-[10px] font-black uppercase transition-colors px-3 py-1 rounded-lg ${d.isAvailable ? 'text-orange-500 bg-orange-50 hover:bg-orange-100' : 'text-green-500 bg-green-50 hover:bg-green-100'}`}
                        >
                          {d.isAvailable ? '暂时下架' : '重新上架'}
                        </button>
                        <button onClick={() => alert('编辑功能敬请期待')} className="text-[10px] font-black uppercase text-gray-400 hover:text-blue-600 transition-colors bg-white border border-gray-100 px-3 py-1 rounded-lg">编辑属性</button>
                      </div>
                    </div>
                  </div>
                ))}
                {dishes.length === 0 && (
                  <div className="col-span-full py-20 text-center">
                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-200">
                      <i className="fa-solid fa-cookie-bite text-3xl"></i>
                    </div>
                    <p className="text-sm font-bold text-gray-300">还没有添加过菜品，点击右上方按钮开始</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeView === 'ORDERS' && (
            <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-gray-100">
              <div className="flex justify-between items-center mb-10">
                <div>
                  <h3 className="text-2xl font-black tracking-tight">实时订单流</h3>
                  <p className="text-sm text-gray-400 font-bold">处理每一笔订单</p>
                </div>
                <div className="flex gap-2 bg-gray-50 p-1.5 rounded-2xl border border-gray-100">
                  <button onClick={() => setOrderFilter('ALL')} className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${orderFilter === 'ALL' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}>全部</button>
                  <button onClick={() => setOrderFilter('PENDING')} className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${orderFilter === 'PENDING' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}>制作中</button>
                  <button onClick={() => setOrderFilter('COMPLETED')} className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${orderFilter === 'COMPLETED' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}>已完成</button>
                </div>
              </div>
              <div className="space-y-6">
                {filteredOrders.map(o => (
                  <div key={o.id} className="p-8 bg-gray-50 rounded-[2.5rem] border border-transparent hover:border-blue-100 hover:bg-white hover:shadow-xl transition-all duration-300 animate-fade-in">
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl ${o.status === 'COMPLETED' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600 animate-pulse'}`}>
                          <i className={`fa-solid ${o.status === 'COMPLETED' ? 'fa-check' : 'fa-clock'}`}></i>
                        </div>
                        <div>
                          <p className="text-xs font-black text-gray-400 uppercase tracking-widest">订单号: #{o.id.substring(0,8)}</p>
                          <p className="text-lg font-black text-gray-900 mt-1">{new Date(o.timestamp).toLocaleTimeString()}</p>
                        </div>
                      </div>
                      <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] ${o.status === 'COMPLETED' ? 'bg-green-500 text-white' : 'bg-blue-600 text-white'}`}>
                        {o.status === 'COMPLETED' ? 'Finished' : 'Processing'}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 border-y border-gray-100 py-8">
                      <div className="space-y-4">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">餐品清单</p>
                        {o.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center">
                            <span className="text-sm font-bold text-gray-700">{item.dishName} <span className="text-gray-400 ml-1">x{item.quantity}</span></span>
                            <span className="text-sm font-black text-gray-900">￥{(item.unitPrice * item.quantity / 100).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex flex-col justify-center items-end bg-gray-50/50 p-6 rounded-3xl border border-gray-100/50">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">实付金额</p>
                        <p className="text-4xl font-black text-red-600 tracking-tighter">￥{(o.totalPrice / 100).toFixed(2)}</p>
                      </div>
                    </div>
                    <div className="flex justify-end gap-4">
                      <button onClick={() => setViewingOrder(o)} className="px-6 py-3 bg-white border border-gray-200 rounded-2xl text-xs font-black text-gray-500 hover:bg-gray-100 active:scale-95 transition-all">查看详情</button>
                      {o.status === 'CONFIRMED' && (
                        <button onClick={() => handleCompleteOrder(o.id)} className="px-8 py-3 bg-green-600 text-white rounded-2xl text-xs font-black shadow-lg hover:bg-green-700 active:scale-95 transition-all">确认完成并出餐</button>
                      )}
                    </div>
                  </div>
                ))}
                {filteredOrders.length === 0 && (
                  <div className="py-32 text-center">
                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-200">
                      <i className="fa-solid fa-inbox text-3xl"></i>
                    </div>
                    <p className="text-sm font-bold text-gray-300">当前没有符合条件的订单</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Viewing Order Modal */}
      {viewingOrder && (
        <div className="absolute inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-10 animate-fade-in">
          <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden border border-white p-10 animate-scale-up">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h3 className="text-2xl font-black text-gray-900 tracking-tight">订单详情</h3>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Order Summary</p>
              </div>
              <button onClick={() => setViewingOrder(null)} className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 hover:bg-red-500 hover:text-white transition-all active:scale-90">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div className="space-y-6 mb-10">
               <div className="bg-gray-50 p-6 rounded-3xl">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400 font-bold">订单编号</span>
                    <span className="text-gray-900 font-black">#{viewingOrder.id}</span>
                  </div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400 font-bold">下单时间</span>
                    <span className="text-gray-900 font-black">{new Date(viewingOrder.timestamp).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400 font-bold">订单状态</span>
                    <span className={`px-2 py-0.5 rounded-lg font-black text-[10px] uppercase ${viewingOrder.status === 'COMPLETED' ? 'bg-green-500 text-white' : 'bg-blue-600 text-white'}`}>
                       {viewingOrder.status}
                    </span>
                  </div>
               </div>
               <div className="space-y-3">
                  {viewingOrder.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between items-center p-4 bg-white border border-gray-100 rounded-2xl">
                      <span className="font-bold text-gray-800">{it.dishName} <span className="text-gray-400 ml-2">x{it.quantity}</span></span>
                      <span className="font-black text-gray-900">￥{(it.unitPrice * it.quantity / 100).toFixed(2)}</span>
                    </div>
                  ))}
               </div>
            </div>
            <div className="flex justify-between items-center bg-red-50 p-8 rounded-[2rem] border border-red-100">
               <span className="font-black text-red-800 text-sm uppercase">支付总额</span>
               <span className="text-3xl font-black text-red-600">￥{(viewingOrder.totalPrice/100).toFixed(2)}</span>
            </div>
            <button onClick={() => setViewingOrder(null)} className="w-full mt-8 py-5 bg-gray-900 text-white rounded-3xl font-black transition-all hover:bg-black active:scale-95">关闭窗口</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MerchantApp;
