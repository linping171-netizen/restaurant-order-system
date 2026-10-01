import axios from 'axios';
export const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api', withCredentials: true });
api.interceptors.response.use(r => r, e => Promise.reject(new Error(e.response?.data?.error?.message || e.message || '请求失败')));
export type Product = { id:number; name:string; description:string; price:number; category:string; image:string; status:'active'|'inactive'; sortOrder:number };
export type Item = { productId:number; name:string; price:number; quantity:number; subtotal:number };
export type Order = { id:string; storeId:string; tableNo:string; items:Item[]; total:number; status:string; createdAt:string };
export type Store = { id:string; name:string; tagline:string; announcement:string; isOpen:boolean; address:string; phone:string };
export function resolveImageUrl(image:string):string {
  if (!image) return '';
  if (image.startsWith('/uploads/')) return new URL(api.defaults.baseURL || 'http://localhost:3000/api').origin + image;
  return image;
}

