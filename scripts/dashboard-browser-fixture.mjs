// Explicit opt-in only. The fixture is excluded from the normal app/build.
import {readFile,writeFile,mkdir,unlink,rmdir} from 'node:fs/promises'
import {resolve} from 'node:path'
const root=resolve(new URL('..',import.meta.url).pathname)
const directory=resolve(root,'app/local-dashboard-qa')
const mode=process.argv[2]
if(!['--install','--remove'].includes(mode)) throw new Error('Use --install before local browser QA, then --remove before building.')
if(process.env.NODE_ENV==='production') throw new Error('This fixture is only for isolated local development.')
const names=['page.tsx','QAClient.tsx']
const content=await Promise.all(names.map(name=>readFile(resolve(root,'tests/fixtures/dashboard',name+'.fixture'),'utf8')))
// Check everything before making a change. Preserve any user-created or edited files.
const existing=await Promise.all(names.map(name=>readFile(resolve(directory,name),'utf8').catch(error=>{if(error.code==='ENOENT')return null;throw error})))
for(let i=0;i<names.length;i++)if(existing[i]!==null&&existing[i]!==content[i])throw new Error(`Preserving changed ${names[i]}; remove or relocate it yourself.`)
if(mode==='--install') {
 await mkdir(directory,{recursive:true})
 for(let i=0;i<names.length;i++)await writeFile(resolve(directory,names[i]),content[i])
 console.log('Installed development-only QA route /local-dashboard-qa. All health data and saves are simulated.')
} else {
 for(let i=0;i<names.length;i++)if(existing[i]!==null)await unlink(resolve(directory,names[i]))
 await rmdir(directory).catch(error=>{if(!['ENOENT','ENOTEMPTY'].includes(error.code))throw error})
 console.log('Removed temporary QA route; fixture source remains under tests/fixtures/dashboard.')
}
