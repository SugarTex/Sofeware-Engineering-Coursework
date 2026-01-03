
export enum LocationType {
  XINGAN = '兴安',
  SHANBEI = '膳北',
  SPECIALTY = '特色餐厅'
}

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  isMerchant: boolean;
}

export interface Store {
  id: string;
  userId: string;
  name: string;
  location: LocationType;
  image: string;
  description: string;
  isOpen: boolean;
  isDeleted: boolean;
}

export interface Dish {
  id: string;
  storeId: string;
  name: string;
  price: number; // in cents
  image: string;
  description: string;
  isAvailable: boolean;
}

export interface OrderItem {
  dishId: string;
  dishName: string;
  quantity: number;
  unitPrice: number;
}

export interface Order {
  id: string;
  buyerId: string;
  storeId: string;
  items: OrderItem[];
  totalPrice: number;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
  timestamp: number;
}

export interface Review {
  id: string;
  orderId: string;
  buyerId: string;
  rating: number; // 1-5
  comment: string;
  timestamp: number;
}

export interface Prediction {
  horizon: 15 | 30 | 60;
  location: LocationType | 'ALL';
  value: number;
}

export interface ActiveSession {
  windowId: string;
  lastHeartbeat: number;
}
