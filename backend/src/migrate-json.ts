import 'dotenv/config';
import { createSupabaseClient } from './supabase-client.js';
import { Pool } from 'pg';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
if(!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.PGSSLMODE==='disable'?false:{rejectUnauthorized:false}});
const json=async<T>(file:string):Promise<T>=>JSON.parse(await fs.readFile(path.join(root,'data',file),'utf8')) as T;
type Store={id:string;name:string;tagline?:string;announcement?:string;isOpen?:boolean;address?:string;phone?:string};
type Product={id:number;storeId?:string;name:string;description?:string;price:number;category:string;image?:string;status:'active'|'inactive';sortOrder?:number};
type Order={id:string;storeId?:string;tableNo:string;items:Array<{productId:number;name:string;price:number;quantity:number;subtotal:number}>;total:number;status:string;createdAt:string};
const stores=await json<Store[]>('stores.json'),products=await json<Product[]>('products.json'),orders=await json<Order[]>('orders.json');
const legacy=await json<Store>('store.json').catch(()=>null);if(!stores.length&&legacy)stores.push({...legacy,id:'store-1'});
const client=await pool.connect();
try{
 await client.query('begin');
 for(const s of stores)await client.query(`insert into stores(id,name,tagline,announcement,is_open,address,phone) values($1,$2,$3,$4,$5,$6,$7) on conflict(id) do update set name=excluded.name,tagline=excluded.tagline,announcement=excluded.announcement,is_open=excluded.is_open,address=excluded.address,phone=excluded.phone`,[s.id,s.name,s.tagline??'',s.announcement??'',s.isOpen??true,s.address??'',s.phone??'']);
 const defaultId=stores[0]?.id||'store-1',categoryIds=new Map<string,number>();
 for(const s of stores)for(const [sort,name] of ['推荐','主食','饮料','甜点'].entries()){const r=await client.query(`insert into categories(store_id,name,sort_order) values($1,$2,$3) on conflict(store_id,name) do update set sort_order=excluded.sort_order returning id`,[s.id,name,sort]);categoryIds.set(`${s.id}:${name}`,Number(r.rows[0].id))}
 const secretKey=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
 const supabase=process.env.SUPABASE_URL&&secretKey?createSupabaseClient(process.env.SUPABASE_URL,secretKey):null,storage=supabase?.storage||null;
 for(const p of products){const sid=p.storeId||defaultId;let image=p.image||'';if(image.startsWith('/uploads/')&&storage){const file=path.join(root,'backend','uploads',path.basename(image)),bytes=await fs.readFile(file),ext=path.extname(file).slice(1).toLowerCase(),object=`${sid}/${p.id}-${path.basename(file)}`;const {error}=await storage.from('product-images').upload(object,bytes,{contentType:ext==='jpg'?'image/jpeg':`image/${ext}`,upsert:true});if(error)throw error;image=storage.from('product-images').getPublicUrl(object).data.publicUrl}const categoryId=categoryIds.get(`${sid}:${p.category}`);if(!categoryId)throw new Error(`Unknown category ${p.category} for ${sid}`);await client.query(`insert into products(id,store_id,name,description,price,category_id,image,status,sort_order) values($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict(id) do update set store_id=excluded.store_id,name=excluded.name,description=excluded.description,price=excluded.price,category_id=excluded.category_id,image=excluded.image,status=excluded.status,sort_order=excluded.sort_order`,[p.id,sid,p.name,p.description??'',p.price,categoryId,image,p.status,p.sortOrder??0])}
 for(const o of orders){const sid=o.storeId||defaultId;await client.query(`insert into orders(id,store_id,table_no,total,status,created_at) values($1,$2,$3,$4,$5,$6) on conflict(id) do update set store_id=excluded.store_id,table_no=excluded.table_no,total=excluded.total,status=excluded.status,created_at=excluded.created_at`,[o.id,sid,o.tableNo,o.total,o.status,o.createdAt]);await client.query('delete from order_items where order_id=$1',[o.id]);for(const i of o.items)await client.query(`insert into order_items(order_id,product_id,product_name,unit_price,quantity,subtotal) values($1,$2,$3,$4,$5,$6)`,[o.id,i.productId,i.name,i.price,i.quantity,i.subtotal])}
 await client.query(`select setval(pg_get_serial_sequence('products','id'),coalesce((select max(id) from products),1),true)`);await client.query('commit');console.log(`Migrated ${stores.length} stores, ${products.length} products, ${orders.length} orders.`);
 if(products.some(p=>(p.image||'').startsWith('/uploads/'))&&!storage)console.warn('Local upload images remain local; set Supabase storage credentials and rerun to transfer them.');
}catch(error){await client.query('rollback');throw error}finally{client.release();await pool.end()}
