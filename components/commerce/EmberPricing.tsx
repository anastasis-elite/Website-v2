'use client'
import {useEffect,useState} from 'react'
import Link from 'next/link'
import * as styles from '@/app/styles/globalstyles'
type Price={available:boolean;amount?:number;currency?:string;amountLabel?:string;intervalLabel?:string;coverageLabel?:string;error?:string}
type Catalog={program:string;subscription:Price;annual:Price}
export default function EmberPricing(){
 const [catalog,setCatalog]=useState<Catalog|null>(null);const [error,setError]=useState('');const [busy,setBusy]=useState<string|null>(null)
 useEffect(()=>{const controller=new AbortController();void fetch('/api/pricing?program=ember',{cache:'no-store',signal:controller.signal}).then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error||'Pricing is temporarily unavailable.');if(!data.subscription || !data.annual)throw new Error('Pricing is temporarily unavailable.');setCatalog(data)}).catch(error=>{if(error.name!=='AbortError')setError(error.message)});return()=>controller.abort()},[])
 async function checkout(billing:'subscription'|'annual'){
  if(busy || !catalog?.[billing].available)return
  setBusy(billing);setError('')
  try{const response=await fetch('/api/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({program:'ember',billing})});const data=await response.json();if(!response.ok || !data.url)throw new Error(data.error||'Checkout could not be opened.');window.location.assign(data.url)}catch(error){setError(error instanceof Error?error.message:'Checkout could not be opened.');setBusy(null)}
 }
 return <section aria-label="Ember pricing"><div style={styles.cardGridStyle}>{(['subscription','annual'] as const).map(billing=>{const price=catalog?.[billing];return <article key={billing} style={styles.cartBoxStyle}><h2 style={styles.sectionTitleStyle}>{billing==='subscription'?'Monthly subscription':'Pay in full'}</h2><p style={{...styles.bodyStyle,fontSize:'1.4rem'}}>{price?.amountLabel || (catalog?'Price unavailable':'Checking current price…')}{price?.intervalLabel?` · ${price.intervalLabel}`:''}</p><p style={styles.bodyStyle}>{price?.coverageLabel || (billing==='annual'?'The access period must be confirmed before this purchase is available.':'The billing interval will be confirmed before checkout.')}</p>{price && !price.available?<p role="status" style={styles.bodyStyle}>{price.error || 'This payment option is currently unavailable. Contact support for help.'}</p>:null}<button type="button" disabled={!price?.available || Boolean(busy)} style={{...styles.primaryButtonStyle,opacity:!price?.available || busy?0.55:1}} onClick={()=>void checkout(billing)}>{busy===billing?'Opening checkout…':billing==='subscription'?'Choose monthly':'Pay in full'}</button></article>})}</div>{error?<p role="status" style={styles.bodyStyle}>{error}</p>:null}<p style={styles.bodyStyle}>Review the <Link href="/refund-policy">billing, cancellation, and refund policy</Link>. Taxes and any applicable checkout details appear before payment. <Link href="/support">Get billing help</Link>.</p></section>
}
