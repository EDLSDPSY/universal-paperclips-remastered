'use strict';
const fs=require('node:fs');
const {encode}=require('./binary.cjs');
function packEdges(raw){
 const bytes=[],write=n=>{while(n>=128){bytes.push((n&127)|128);n>>>=7;}bytes.push(n);};let previous=0;
 for(let offset=0;offset<raw.length;){const first=raw.readUInt16LE(offset);let end=offset+5;while(end<raw.length&&raw.readUInt16LE(end)===first)end+=5;write(first-previous);write((end-offset)/5);previous=first;
  for(;offset<end;offset+=5){const delta=raw.readUInt16LE(offset+2)-first;write((delta<<1)^(delta>>31));bytes.push(raw[offset+4]);}
 }
 return Buffer.from(bytes);
}
function compileGeometry(file){
 const source=fs.readFileSync(file,'utf8'),name=source.match(/^const (\w+)=/)[1],data=JSON.parse(source.slice(source.indexOf('=')+1).replace(/;\s*$/,'')),raw=Buffer.from(data.edges,'base64');
 data.adjacency=encode(packEdges(raw));data.nodes=encode(Buffer.from(data.nodes,'base64'));data.walls=encode(Buffer.from(data.walls,'base64'));data.encoding='base92';data.edgeCount=raw.length/5;delete data.edges;
 return 'const '+name+'='+JSON.stringify(data)+';\n';
}
module.exports={packEdges,compileGeometry};
