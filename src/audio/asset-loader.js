function createMusicAssetLoader(){
 let worker,url,idle,external,nextId=0;const jobs=new Map();
 function close(error){
  external?.abort(error);external=null;
  clearTimeout(idle);worker?.terminate();worker=null;if(url)URL.revokeObjectURL(url);url=null;
  for(const job of jobs.values())job.reject(error);jobs.clear();
 }
 async function loadExternal(file,gzip){
  const controller=external??=new AbortController();
  const response=await fetch(new URL(file,MUSIC_ASSETS.base),{signal:controller.signal});
  if(!response.ok)throw Error('无法读取音频资源 '+file+' ('+response.status+')');
  if(!gzip)return response.arrayBuffer();
  return new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
 }
 function load(text,gzip){
  if(MUSIC_ASSETS.base)return loadExternal(text,gzip);
  clearTimeout(idle);
  if(!worker){
   const source=BINARY_DECODER_SOURCE+'('+function(){
    onmessage=async({data:{id,text,gzip}})=>{try{
     const bytes=decodeBinary(text),buffer=gzip?await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer():bytes.buffer;
     postMessage({id,buffer},[buffer]);
    }catch(error){postMessage({id,error:error.message});}};
   }.toString()+')();';
   url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));worker=new Worker(url);
   worker.onmessage=({data})=>{const job=jobs.get(data.id);if(!job)return;jobs.delete(data.id);if(data.error)job.reject(Error(data.error));else job.resolve(data.buffer);if(!jobs.size)idle=setTimeout(()=>close(),2000);};
   worker.onerror=event=>close(Error(event.message));
  }
  return new Promise((resolve,reject)=>{const id=++nextId;jobs.set(id,{resolve,reject});worker.postMessage({id,text,gzip});});
 }
 return {load,close};
}
