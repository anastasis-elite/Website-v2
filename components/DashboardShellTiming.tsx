// Observe the shell DOM after two animation frames before React hydration.
// This paint proxy contains no member data and writes only local timing entries.
const shellTiming = `try{if(typeof performance!=='undefined'&&!performance.getEntriesByName('anastasis:shell').length){requestAnimationFrame(function(){requestAnimationFrame(function(){try{if(!performance.getEntriesByName('anastasis:shell').length){performance.mark('anastasis:shell');performance.measure('anastasis:navigation-to-shell',{start:0,end:'anastasis:shell'})}}catch(e){}})})}}catch(e){}`

export default function DashboardShellTiming() {
  return <script dangerouslySetInnerHTML={{ __html: shellTiming }} />
}
