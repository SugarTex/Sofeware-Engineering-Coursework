
import React, { useState, useEffect, useMemo } from 'react';
import { User, Store, Dish, LocationType, Order, OrderItem, Review } from '../types';
import { getDB, saveDB, notifyDBSync } from '../db';
import { getPredictions } from '../services/geminiService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface StudentAppProps {
  user: User;
}

const StudentApp: React.FC<StudentAppProps> = ({ user }) => {
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [cart, setCart] = useState<{dish: Dish, quantity: number}[]>([]);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [loadingPreds, setLoadingPreds] = useState(false);
  const [filterLoc, setFilterLoc] = useState<string>('ALL');
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [myReviews, setMyReviews] = useState<Review[]>([]);
  
  const [isConfirming, setIsConfirming] = useState(false);
  
  // Review Logic
  const [reviewingOrderId, setReviewingOrderId] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  const refreshData = () => {
    const db = getDB();
    let sList = db.stores.filter(s => !s.isDeleted);
    sList.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
    setStores(sList);
    setMyOrders(db.orders.filter(o => o.buyerId === user.id).sort((a,b)=>b.timestamp - a.timestamp));
    setMyReviews(db.reviews.filter(r => r.buyerId === user.id));
    if (selectedStore) {
      setDishes(db.dishes.filter(d => d.storeId === selectedStore.id));
    }
  };

  const fetchPredictions = async () => {
    setLoadingPreds(true);
    const result = await getPredictions();
    setPredictions(result);
    setTimeout(() => setLoadingPreds(false), 800);
  };

  useEffect(() => {
    refreshData();
    fetchPredictions();
    window.addEventListener('storage', refreshData);
    return () => window.removeEventListener('storage', refreshData);
  }, []);

  const addToCart = (dish: Dish) => {
    setCart(prev => {
      const existing = prev.find(item => item.dish.id === dish.id);
      if (existing) {
        return prev.map(item => item.dish.id === dish.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { dish, quantity: 1 }];
    });
  };

  const removeFromCart = (dishId: string) => {
    setCart(prev => prev.filter(item => item.dish.id !== dishId));
  };

  const goToConfirmation = () => {
    if (cart.length === 0) return;
    setIsConfirming(true);
  };

  const finalSubmitOrder = () => {
    if (cart.length === 0 || !selectedStore) return;
    const db = getDB();
    const orderItems: OrderItem[] = cart.map(item => ({
      dishId: item.dish.id,
      dishName: item.dish.name,
      quantity: item.quantity,
      unitPrice: item.dish.price
    }));
    const total = orderItems.reduce((acc, item) => acc + (item.unitPrice * item.quantity), 0);
    
    const newOrder: Order = {
      id: Math.random().toString(36).substring(7),
      buyerId: user.id,
      storeId: selectedStore.id,
      items: orderItems,
      totalPrice: total,
      status: 'CONFIRMED',
      timestamp: Date.now()
    };
    
    db.orders.push(newOrder);
    saveDB(db);
    notifyDBSync();
    setCart([]);
    setIsConfirming(false);
    refreshData();
    alert('下单成功！商家已收到您的订单并开始制作。');
  };

  const submitReview = () => {
    if (!reviewingOrderId) return;
    if (!reviewComment) return alert('请输入评价内容');
    const db = getDB();
    const newReview: Review = {
      id: Math.random().toString(36).substring(7),
      orderId: reviewingOrderId,
      buyerId: user.id,
      rating: reviewRating,
      comment: reviewComment,
      timestamp: Date.now()
    };
    db.reviews.push(newReview);
    saveDB(db);
    notifyDBSync();
    setReviewingOrderId(null);
    setReviewComment('');
    setReviewRating(5);
    refreshData();
    alert('感谢您的评价！您的反馈对商家非常重要。');
  };

  const chartData = useMemo(() => {
    return predictions
      .filter(p => p.location === 'ALL')
      .sort((a, b) => a.horizon - b.horizon)
      .map(p => ({
        ...p,
        label: `${p.horizon}min后`
      }));
  }, [predictions]);

  const filteredStores = stores.filter(s => filterLoc === 'ALL' || s.location === filterLoc);

  if (isConfirming) {
    const total = cart.reduce((acc, item) => acc + (item.dish.price * item.quantity), 0);
    return (
      <div className="absolute inset-0 z-[100] bg-gray-900/90 backdrop-blur-lg flex items-center justify-center p-6 animate-fade-in">
        <div className="bg-white w-full max-w-lg rounded-[2rem] overflow-hidden shadow-2xl flex flex-col max-h-[90%] border border-white/20 animate-scale-up">
          <div className="bg-red-600 px-8 py-10 text-white text-center relative">
            <div className="absolute top-4 left-4 w-12 h-12 bg-white/10 rounded-full flex items-center justify-center">
              <i className="fa-solid fa-check text-xl"></i>
            </div>
            <h2 className="text-3xl font-black tracking-tight">确认支付订单</h2>
            <p className="text-red-100/80 text-sm mt-2 font-medium">请核对餐品清单，点击确认即视为支付成功</p>
          </div>
          <div className="flex-1 overflow-auto p-8 bg-white">
            <div className="mb-8 p-6 bg-gray-50 rounded-2xl border border-gray-100">
              <div className="flex items-center gap-3 mb-2">
                <i className="fa-solid fa-store text-red-500"></i>
                <p className="text-xl font-black text-gray-900">{selectedStore?.name}</p>
              </div>
              <p className="text-sm text-gray-400 font-bold ml-7 uppercase tracking-widest">{selectedStore?.location} 校区</p>
            </div>
            <div className="space-y-5 mb-8">
              {cart.map(item => (
                <div key={item.dish.id} className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="font-bold text-gray-800">{item.dish.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">单价 ￥{(item.dish.price/100).toFixed(2)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-gray-900">x {item.quantity}</p>
                    <p className="text-sm font-black text-red-600 mt-0.5">￥{(item.dish.price * item.quantity / 100).toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-red-50 p-8 rounded-3xl flex justify-between items-center border border-red-100">
              <span className="font-black text-red-800 uppercase tracking-widest text-xs">实付金额</span>
              <span className="text-4xl font-black text-red-600 drop-shadow-sm">￥{(total/100).toFixed(2)}</span>
            </div>
          </div>
          <div className="p-8 bg-gray-50 border-t border-gray-100 flex gap-4">
            <button onClick={() => setIsConfirming(false)} className="flex-1 py-5 bg-white border border-gray-200 text-gray-600 rounded-2xl font-black hover:bg-gray-100 transition-all active:scale-95 shadow-sm">返回修改</button>
            <button onClick={finalSubmitOrder} className="flex-1 py-5 bg-red-600 text-white rounded-2xl font-black shadow-xl hover:bg-red-700 active:scale-95 transition-all">确认并支付</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-gray-50 overflow-hidden relative">
      {/* Review Modal */}
      {reviewingOrderId && (
        <div className="absolute inset-0 z-[110] bg-black/60 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl border border-white animate-scale-up">
            <h2 className="text-2xl font-black mb-2 flex items-center gap-3">
              <i className="fa-solid fa-comment-dots text-yellow-500"></i>
              <span>撰写餐后评价</span>
            </h2>
            <p className="text-gray-400 text-sm mb-8 font-medium italic">分享您的真实用餐感受</p>
            <div className="flex justify-center gap-4 mb-10">
              {[1,2,3,4,5].map(star => (
                <button key={star} onClick={() => setReviewRating(star)} className={`text-3xl transition-all hover:scale-125 active:scale-90 ${reviewRating >= star ? 'text-yellow-400' : 'text-gray-200'}`}>
                  <i className="fa-solid fa-star"></i>
                </button>
              ))}
            </div>
            <textarea value={reviewComment} onChange={e => setReviewComment(e.target.value)} placeholder="菜品味道如何？包装是否满意？" className="w-full bg-gray-50 border-2 border-gray-100 rounded-3xl p-6 text-sm focus:ring-4 focus:ring-blue-500/10 focus:outline-none h-40 resize-none mb-8 font-medium"></textarea>
            <div className="flex gap-4">
              <button onClick={() => setReviewingOrderId(null)} className="flex-1 py-4 bg-gray-100 text-gray-500 rounded-2xl font-bold hover:bg-gray-200 active:scale-95 transition-all">取消</button>
              <button onClick={submitReview} className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-xl hover:bg-blue-700 active:scale-95 transition-all">提交发布</button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div className="w-80 border-r bg-white flex flex-col h-full shadow-lg z-10 shrink-0">
        <div className="p-8 border-b bg-white">
          <h2 className="text-2xl font-black mb-6 flex items-center gap-3 cursor-pointer" onClick={() => setSelectedStore(null)}>
            <i className="fa-solid fa-utensils text-blue-600"></i>
            <span>校园在线点单</span>
          </h2>
          <div className="relative">
            <select value={filterLoc} onChange={e=>setFilterLoc(e.target.value)} className="w-full appearance-none bg-gray-50 border border-gray-100 shadow-sm p-4 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-blue-500/10 focus:outline-none transition-all pr-10 cursor-pointer outline-none">
              <option value="ALL">全部校区地点</option>
              {Object.values(LocationType).map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            <i className="fa-solid fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none text-xs"></i>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4 space-y-4 no-scrollbar">
          {filteredStores.map(s => (
            <div key={s.id} onClick={() => { setSelectedStore(s); setDishes(getDB().dishes.filter(d => d.storeId === s.id)); setCart([]); }} className={`p-5 rounded-3xl cursor-pointer transition-all border-2 active:scale-95 ${selectedStore?.id === s.id ? 'bg-blue-600 border-blue-600 shadow-xl shadow-blue-200 translate-x-1' : 'bg-white border-gray-50 hover:border-blue-200 hover:bg-blue-50/50'}`}>
              <div className="flex justify-between items-start mb-3">
                <span className={`text-base font-black leading-tight ${selectedStore?.id === s.id ? 'text-white' : 'text-gray-900'}`}>{s.name}</span>
                <span className={`text-[10px] px-2 py-1 rounded-lg font-black uppercase tracking-widest ${s.isOpen ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {s.isOpen ? '营业中' : '休息中'}
                </span>
              </div>
              <div className={`flex items-center gap-2 text-xs font-bold ${selectedStore?.id === s.id ? 'text-blue-100' : 'text-gray-400'}`}>
                <i className="fa-solid fa-location-dot text-[10px]"></i>
                <span>{s.location}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="p-6 bg-gray-900 text-white rounded-t-[2.5rem] shadow-inner">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-black text-blue-400 flex items-center gap-2">
              <span className={`w-2 h-2 bg-blue-500 rounded-full ${loadingPreds ? 'animate-pulse' : 'animate-ping'}`}></span>
              客流预测引擎
            </span>
            <button onClick={fetchPredictions} disabled={loadingPreds} className={`text-[10px] font-black uppercase tracking-widest transition-all ${loadingPreds ? 'text-gray-600' : 'text-gray-400 hover:text-white active:scale-90'}`}>
              {loadingPreds ? 'CALCULATING...' : 'REFRESH'}
            </button>
          </div>
          <div className="space-y-3">
            {predictions.filter(p => p.horizon === 15).map(p => (
              <div key={`${p.location}-${p.horizon}`} className="flex justify-between items-center text-[11px] font-bold animate-fade-in">
                <span className="text-gray-500 uppercase tracking-tighter">{p.location === 'ALL' ? '全校热度' : p.location}</span>
                <span className={p.value > 15 ? 'text-red-500' : 'text-green-500'}>{p.value} <span className="text-[9px] text-gray-600 font-medium">笔/15分</span></span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full bg-white relative animate-fade-in overflow-hidden">
        {selectedStore ? (
          <div className="flex flex-col h-full overflow-hidden">
            <div className="h-64 relative overflow-hidden shrink-0">
              <img src={selectedStore.image} className="w-full h-full object-cover transform transition-transform duration-1000 hover:scale-110" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col justify-end p-12">
                <div className="flex items-center gap-5 mb-3">
                   <h1 className="text-5xl font-black text-white tracking-tighter">{selectedStore.name}</h1>
                   <div className="px-4 py-1.5 bg-blue-600 text-white text-[10px] font-black rounded-full uppercase tracking-widest shadow-lg shadow-blue-500/30">
                     {selectedStore.location} 校区
                   </div>
                </div>
                <p className="text-white/60 text-base font-medium line-clamp-2 max-w-3xl leading-relaxed">{selectedStore.description}</p>
                <button onClick={() => setSelectedStore(null)} className="absolute top-8 right-8 w-12 h-12 rounded-full bg-white/10 backdrop-blur-md text-white flex items-center justify-center hover:bg-white/20 transition-all active:scale-90 border border-white/10">
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-12 bg-gray-50/50 no-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                {dishes.map(d => (
                  <div key={d.id} className={`bg-white group rounded-[2.5rem] overflow-hidden shadow-sm hover:shadow-xl transition-all flex flex-col hover:-translate-y-2 border border-white ${!d.isAvailable && 'grayscale pointer-events-none opacity-50'}`}>
                    <div className="relative h-56 overflow-hidden">
                      <img src={d.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                      <div className="absolute top-5 right-5 bg-white/90 backdrop-blur-md px-4 py-2 rounded-2xl font-black text-red-600 text-base shadow-xl border border-white/50">￥{(d.price/100).toFixed(2)}</div>
                    </div>
                    <div className="p-8 flex-1 flex flex-col">
                      <h3 className="font-black text-xl text-gray-900 mb-2 leading-tight group-hover:text-blue-600 transition-colors">{d.name}</h3>
                      <p className="text-sm text-gray-400 mb-8 flex-1 font-medium leading-relaxed italic">{d.description || '精心烹制，只为给您带来校园好味道。'}</p>
                      <button disabled={!selectedStore.isOpen || !d.isAvailable} onClick={() => addToCart(d)} className={`w-full py-4 rounded-3xl font-black text-sm tracking-wide transition-all flex items-center justify-center gap-3 active:scale-95 ${selectedStore.isOpen ? 'bg-gray-900 text-white hover:bg-red-600 shadow-xl' : 'bg-gray-100 text-gray-300 cursor-not-allowed'}`}>
                        <i className="fa-solid fa-cart-shopping"></i>
                        {selectedStore.isOpen ? '加入点餐车' : '商家休息中'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-16 overflow-auto bg-white no-scrollbar">
            <div className="max-w-5xl w-full">
              <div className="flex items-end justify-between mb-12 border-b-4 border-gray-100 pb-10">
                <div>
                  <h2 className="text-5xl font-black text-gray-900 tracking-tighter">全校点单热度盘</h2>
                  <p className="text-lg text-gray-400 mt-3 font-bold uppercase tracking-[0.2em]">Live Data • Global Tracking</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-300 font-black uppercase tracking-widest mb-1">活跃会话</p>
                  <p className="text-5xl font-black text-blue-600 tabular-nums">{(getDB().sessions.length)}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
                {Object.values(LocationType).map(loc => {
                  const val = predictions.find(p => p.location === loc && p.horizon === 15)?.value || 0;
                  const isBusy = val > 12;
                  return (
                    <div key={loc} onClick={() => setFilterLoc(loc)} className={`p-10 rounded-[3.5rem] border-2 transition-all cursor-pointer active:scale-95 ${isBusy ? 'bg-red-50/50 border-red-100 shadow-[0_30px_60px_rgba(239,68,68,0.1)]' : 'bg-white border-gray-50 shadow-sm'}`}>
                      <div className="flex justify-between items-start mb-6">
                         <span className={`text-xs font-black uppercase tracking-[0.2em] ${isBusy ? 'text-red-500' : 'text-blue-500'}`}>{loc}</span>
                         <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isBusy ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                           <i className={`fa-solid ${isBusy ? 'fa-fire-flame-curved' : 'fa-mug-hot'}`}></i>
                         </div>
                      </div>
                      <p className={`text-3xl font-black mb-2 tracking-tight ${isBusy ? 'text-red-700' : 'text-gray-900'}`}>{isBusy ? '排队严重' : val > 6 ? '人气火爆' : '随到随吃'}</p>
                      <p className="text-sm font-bold text-gray-400">预计 15min 内有 <span className="text-gray-900 font-black">{val}</span> 笔新单</p>
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-20">
                <div className="bg-white p-10 rounded-[3.5rem] border border-gray-100 shadow-sm h-[450px] animate-fade-in relative">
                  <h3 className="font-black text-xl text-gray-900 mb-10 tracking-tight flex items-center gap-3">
                    <i className="fa-solid fa-chart-line text-blue-500"></i> 全校点单时段预测
                  </h3>
                  {loadingPreds && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-20">
                       <i className="fa-solid fa-circle-notch fa-spin text-4xl text-blue-500"></i>
                    </div>
                  )}
                  <ResponsiveContainer width="100%" height="75%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fontSize: 12, fontWeight: 900, fill: '#64748b'}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fontWeight: 900, fill: '#cbd5e1'}} />
                      <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 50px rgba(0,0,0,0.1)', padding: '20px' }} />
                      <Bar dataKey="value" radius={[16, 16, 16, 16]} barSize={50}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={['#3b82f6', '#1e40af', '#1d4ed8'][index % 3]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white p-10 rounded-[3.5rem] border border-gray-100 shadow-sm h-[450px] flex flex-col animate-fade-in">
                   <h3 className="font-black text-xl text-gray-900 mb-8 tracking-tight flex items-center gap-3">
                    <i className="fa-solid fa-clock-rotate-left text-red-500"></i> 我的订单历史
                  </h3>
                  <div className="flex-1 overflow-auto space-y-5 pr-2 no-scrollbar">
                    {myOrders.slice(0, 10).map(o => {
                      const hasReviewed = myReviews.some(r => r.orderId === o.id);
                      const s = stores.find(st=>st.id === o.storeId);
                      return (
                        <div key={o.id} onClick={() => { if (o.status === 'COMPLETED' && !hasReviewed) setReviewingOrderId(o.id); else if (s) { setSelectedStore(s); setDishes(getDB().dishes.filter(d=>d.storeId===s.id)); } }} className="group p-6 rounded-[2rem] bg-gray-50 border border-transparent hover:border-blue-100 hover:bg-white transition-all flex justify-between items-center shadow-sm hover:shadow-xl cursor-pointer active:scale-95">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-black text-gray-900 group-hover:text-blue-600 transition-colors">{s?.name || '餐厅已注销'}</p>
                            </div>
                            <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-tighter">{new Date(o.timestamp).toLocaleString()}</p>
                          </div>
                          <div className="text-right flex flex-col items-end gap-2">
                            <p className="text-xl font-black text-red-600">￥{(o.totalPrice/100).toFixed(2)}</p>
                            {o.status === 'COMPLETED' && !hasReviewed && (
                              <button onClick={(e) => { e.stopPropagation(); setReviewingOrderId(o.id); }} className="px-3 py-1 bg-yellow-500 text-white text-[10px] font-black rounded-lg hover:bg-yellow-600 transition-colors">立即评价</button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {cart.length > 0 && !isConfirming && (
        <div className="w-[420px] bg-white border-l shadow-2xl flex flex-col p-10 animate-slide-in-right z-30 h-full">
          <div className="flex justify-between items-center mb-10">
            <h2 className="text-3xl font-black flex items-center gap-3">
              <i className="fa-solid fa-bag-shopping text-red-600"></i> 已点选
            </h2>
          </div>
          <div className="flex-1 overflow-auto space-y-8 pr-2 no-scrollbar">
            {cart.map(item => (
              <div key={item.dish.id} className="flex justify-between items-center gap-6 animate-fade-in group">
                <div className="flex-1">
                  <p className="text-base font-black text-gray-900">{item.dish.name}</p>
                  <p className="text-xs text-gray-400 font-bold mt-1">￥{(item.dish.price/100).toFixed(2)} / 份</p>
                </div>
                <div className="flex items-center gap-5">
                  <div className="bg-gray-100 px-4 py-2 rounded-xl font-black text-gray-900 text-sm">{item.quantity}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-100 pt-10 mt-8 pb-12 shrink-0">
            <div className="flex justify-between items-end mb-10">
              <span className="text-5xl font-black text-red-600 tracking-tighter">￥{(cart.reduce((acc,item)=>acc+(item.dish.price * item.quantity),0)/100).toFixed(2)}</span>
            </div>
            <button onClick={goToConfirmation} className="w-full bg-red-600 text-white py-6 rounded-[2rem] font-black text-lg shadow-xl hover:bg-red-700 active:scale-95 transition-all flex items-center justify-center gap-4">确 认 支 付</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentApp;
