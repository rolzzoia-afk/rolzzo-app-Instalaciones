/* Almacén de los archivos (fotos/PDF) pendientes de subir del borrador de
   "OT nueva", en IndexedDB en vez de localStorage: localStorage no puede
   guardar archivos binarios, así que si la página se recargaba o el
   navegador mataba la pestaña en segundo plano (común en celulares),
   las fotos ya seleccionadas se perdían aunque el resto del formulario
   sí se recuperaba. IndexedDB sí soporta blobs y tiene mucho más espacio.

   Cada registro queda asociado a una "draftKey" (ver regDraftKey() en
   registro-adjuntos.js), igual que el borrador de texto en localStorage:
   así las fotos también quedan separadas por operador. */
const DB_NAME='rolzzo_reg_draft_files';
const STORE='files';
let dbPromise=null;
function openDb(){
  if(dbPromise)return dbPromise;
  dbPromise=new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,1);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains(STORE)){
        const store=db.createObjectStore(STORE,{keyPath:'id',autoIncrement:true});
        store.createIndex('draftKey','draftKey',{unique:false});
      }
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
  return dbPromise;
}
export async function saveDraftFile(draftKey,file){
  try{
    const db=await openDb();
    return await new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,'readwrite');
      const req=tx.objectStore(STORE).add({draftKey,name:file.name,type:file.type,blob:file});
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error);
    });
  }catch(e){console.error('No se pudo guardar el adjunto del borrador:',e);return null;}
}
export async function deleteDraftFile(id){
  if(id==null)return;
  try{
    const db=await openDb();
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete=()=>resolve();
      tx.onerror=()=>reject(tx.error);
    });
  }catch(e){console.error('No se pudo borrar el adjunto del borrador:',e);}
}
export async function getDraftFiles(draftKey){
  try{
    const db=await openDb();
    return await new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,'readonly');
      const req=tx.objectStore(STORE).index('draftKey').getAll(draftKey);
      req.onsuccess=()=>resolve(req.result||[]);
      req.onerror=()=>reject(req.error);
    });
  }catch(e){console.error('No se pudieron leer los adjuntos del borrador:',e);return[];}
}
export async function clearDraftFiles(draftKey){
  try{
    const db=await openDb();
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,'readwrite');
      const req=tx.objectStore(STORE).index('draftKey').openCursor(IDBKeyRange.only(draftKey));
      req.onsuccess=()=>{
        const cursor=req.result;
        if(cursor){cursor.delete();cursor.continue();}
      };
      tx.oncomplete=()=>resolve();
      tx.onerror=()=>reject(tx.error);
    });
  }catch(e){console.error('No se pudieron borrar los adjuntos del borrador:',e);}
}
