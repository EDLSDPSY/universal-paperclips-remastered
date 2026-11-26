'use strict';
// 排除字符串引号、反斜线和 HTML 标签起始符，其余可打印 ASCII 都可用于存放数据。
const alphabet=Array.from({length:95},(_,i)=>String.fromCharCode(32+i)).filter(c=>!['"','\\','<'].includes(c)).join('');
function encode(raw){
 const out=Buffer.alloc(Math.ceil(raw.length*16/13)+7);let length=raw.length;
 // 长度放在前五个字符中，使解码器可以一次分配准确大小的缓冲区。
 for(let i=4;i>=0;i--){out[i]=alphabet.charCodeAt(length%92);length=Math.floor(length/92);}
 let bits=0,value=0,at=5;
 for(const byte of raw){
  value|=byte<<bits;bits+=8;
  if(bits>13){let pair=value&8191,n=13;if(pair<272){pair=value&16383;n=14;}out[at++]=alphabet.charCodeAt(pair%92);out[at++]=alphabet.charCodeAt(Math.floor(pair/92));value>>>=n;bits-=n;}
 }
 if(bits){out[at++]=alphabet.charCodeAt(value%92);if(bits>7||value>=92)out[at++]=alphabet.charCodeAt(Math.floor(value/92));}
 return out.toString('ascii',0,at);
}
function createDecoder(alphabet){
 const digits=new Uint8Array(128);for(let i=0;i<alphabet.length;i++)digits[alphabet.charCodeAt(i)]=i;
 return text=>{
  let length=0;for(let i=0;i<5;i++)length=length*92+digits[text.charCodeAt(i)];
  const out=new Uint8Array(length);let bits=0,value=0,at=0;
  for(let i=5;i+1<text.length;i+=2){const pair=digits[text.charCodeAt(i)]+92*digits[text.charCodeAt(i+1)];value|=pair<<bits;bits+=(pair&8191)<272?14:13;while(bits>=8){out[at++]=value&255;value>>>=8;bits-=8;}}
  if((text.length-5)&1)out[at]=value|(digits[text.charCodeAt(text.length-1)]<<bits);
  return out;
 };
}
const source='const createBinaryDecoder='+createDecoder.toString()+';\nconst BINARY_ALPHABET='+JSON.stringify(alphabet)+';\nconst decodeBinary=createBinaryDecoder(BINARY_ALPHABET);\nconst BINARY_DECODER_SOURCE="const decodeBinary=("+createBinaryDecoder.toString()+")("+JSON.stringify(BINARY_ALPHABET)+");";\n';
module.exports={alphabet,encode,createDecoder,source};
