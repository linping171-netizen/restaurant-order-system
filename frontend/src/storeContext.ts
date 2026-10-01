import { ref } from 'vue';
import { api, type Store } from './api';
export const stores = ref<Store[]>([]);
export const activeStoreId = ref(localStorage.getItem('restaurant-active-store') || 'store-1');
export async function loadStores(){
  stores.value=(await api.get('/stores')).data.data;
  if(!stores.value.some(s=>s.id===activeStoreId.value)) activeStoreId.value=stores.value[0]?.id||'store-1';
  localStorage.setItem('restaurant-active-store',activeStoreId.value);
}
export function selectStore(id:string){activeStoreId.value=id;localStorage.setItem('restaurant-active-store',id)}
