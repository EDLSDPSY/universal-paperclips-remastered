'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {spawnSync}=require('node:child_process');
const temporary=require('./temporary-directory.cjs');

const root=path.resolve(__dirname,'..');
const kernels=path.join(root,'src','kernels');
const tools=path.join(root,'node_modules');

function run(file,args){
 const result=spawnSync(process.execPath,[path.join(tools,file),...args],{cwd:root,stdio:'inherit',windowsHide:true});
 if(result.error)throw result.error;
 if(result.status!==0)throw Error(`${file} 退出码为 ${result.status}`);
}

function compileWat(wabt,name){
 const file=path.join(kernels,name+'.wat');
 const source=wabt.parseWat(name,fs.readFileSync(file,'utf8'),{simd:true,bulk_memory:true});
 try{
  source.validate();
  return Buffer.from(source.toBinary({canonicalize_lebs:true,write_debug_names:false}).buffer);
 }finally{source.destroy();}
}

function wasmModule(name,...variants){
 const load=bytes=>`try{return new WebAssembly.Module(Uint8Array.from(atob('${bytes.toString('base64')}'),c=>c.charCodeAt(0)));}catch{}`;
 return `const ${name}=(()=>{${variants.map(load).join('')}return null;})();`;
}

function stellarEquations(){
 const temp=temporary();
 const wasm=path.join(temp.directory,'stellar.wasm'),fallback=path.join(temp.directory,'stellar.mjs');
 try{
  run('assemblyscript/bin/asc.js',[path.join(kernels,'stellar-equations.ts'),'--runtime','stub','--noAssert',
   '--uncheckedBehavior','always','--optimizeLevel','3','--shrinkLevel','0','--outFile',wasm]);
  run('binaryen/bin/wasm2js',[wasm,'--all-features','-O3','-o',fallback]);
  const output=fs.readFileSync(fallback,'utf8');
  const wrapper=/^import \* as env from 'env';\s*([\s\S]+)\nvar retasmFunc = asmFunc\(\{\s*"env": env,\s*\}\);\s*(?:export var \w+ = retasmFunc\.\w+;\s*)+$/;
  const body=output.match(wrapper)?.[1];
  assert(body,'无法读取 wasm2js 生成的模块');
  const translated=body.replace(/^\s*\/\*\* @noinline .*\*\/\n/m,'\n')
   .replace(/^\s*\/\/ TODO: traps on invalid things\n/m,'\n');
  return `${wasmModule('STELLAR_RESPONSE_MODULE',fs.readFileSync(wasm))}\n\n`+
   '// WebAssembly 无法启动时，用同一套方程生成的 JavaScript 继续求解。\n'+
   `function createStellarResponseJS(env){\n${translated}\nreturn asmFunc({env});\n}`;
 }finally{temp.remove();}
}

async function main(){
 const wabt=await require('wabt')();
 const compiled=[stellarEquations(),
  wasmModule('STELLAR_CULL_MODULE',compileWat(wabt,'star-filter')),
  wasmModule('CPU_GAUSSIAN_MODULE',compileWat(wabt,'phosphor-simd'),compileWat(wabt,'phosphor'))
 ].join('\n\n')+'\n';
 new vm.Script(compiled);
 fs.writeFileSync(path.join(kernels,'compiled.js'),compiled);
 console.log('已更新 src/kernels/compiled.js');
}

main().catch(error=>{console.error(error);process.exitCode=1;});
