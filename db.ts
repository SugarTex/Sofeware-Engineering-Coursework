
import { User, Store, Dish, Order, Review, ActiveSession } from './types';

const DB_KEY = 'CAMPUS_FOOD_DB';

interface DatabaseSchema {
  users: User[];
  stores: Store[];
  dishes: Dish[];
  orders: Order[];
  reviews: Review[];
  sessions: ActiveSession[];
}

const INITIAL_DB: DatabaseSchema = {
  users: [],
  stores: [],
  dishes: [],
  orders: [],
  reviews: [],
  sessions: []
};

export const getDB = (): DatabaseSchema => {
  const data = localStorage.getItem(DB_KEY);
  return data ? JSON.parse(data) : INITIAL_DB;
};

export const saveDB = (db: DatabaseSchema) => {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
};

// Simplified multi-window sync event
export const notifyDBSync = () => {
  window.dispatchEvent(new Event('storage'));
};

// Data Helpers
export const findUser = (username: string) => getDB().users.find(u => u.username === username);
export const getStores = () => getDB().stores.filter(s => !s.isDeleted);
export const getStoreDishes = (storeId: string) => getDB().dishes.filter(d => d.storeId === storeId);
export const getStoreOrders = (storeId: string) => getDB().orders.filter(o => o.storeId === storeId);
