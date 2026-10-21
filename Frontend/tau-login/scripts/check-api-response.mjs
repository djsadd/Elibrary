import assert from 'node:assert/strict';
import { createServer } from 'vite';
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'error'});
const originalFetch=globalThis.fetch;
const memory=new Map([['token','test-access']]);
const storage={getItem:key=>memory.get(key)||null,setItem:(key,value)=>memory.set(key,value),removeItem:key=>memory.delete(key)};
globalThis.localStorage=storage;globalThis.sessionStorage=storage;
try {
 const {api}=await server.ssrLoadModule('/src/shared/api/client.ts');
 for(const status of [204,205]) {
   globalThis.fetch=async()=>new Response(null,{status});
   assert.equal(await api('/api/favourites/4',{method:'DELETE'}),undefined);
 }
 globalThis.fetch=async()=>Response.json({id:4});
 assert.deepEqual(await api('/api/catalog/books/4'),{id:4});
 globalThis.fetch=async()=>Response.json({detail:'Denied'},{status:403});
 await assert.rejects(()=>api('/api/catalog/books/4'),/Denied/);
 memory.set('refresh_token','test-refresh');let calls=0;
 globalThis.fetch=async()=>{
   calls++;
   if(calls===1)return new Response(null,{status:401});
   if(calls===2)return Response.json({access_token:'new-access',refresh_token:'new-refresh'});
   return new Response(null,{status:204});
 };
 assert.equal(await api('/api/favourites/4',{method:'DELETE'}),undefined);
 assert.equal(calls,3);assert.equal(memory.get('token'),'new-access');
 console.log('API response checks passed: 204, 205, JSON, errors and refreshed-token DELETE.');
}finally{globalThis.fetch=originalFetch;delete globalThis.localStorage;delete globalThis.sessionStorage;await server.close();}
