import fs from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
for(const name of (await fs.readdir('.')).filter(name=>name.endsWith('.mjs'))){
 const result=spawnSync(process.execPath,['--check',name],{stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);
}
console.log('PASS JavaScript syntax');
