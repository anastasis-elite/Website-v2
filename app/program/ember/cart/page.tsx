import * as styles from '@/app/styles/globalstyles'
import TrackEvent from '@/components/TrackEvent'
import EmberPricing from '@/components/commerce/EmberPricing'
export default function EmberCartPage(){return <><TrackEvent event="ember_cart_page_viewed" properties={{page:'ember_cart'}}/><main style={styles.pageStyle}><div style={styles.containerStyle}><p style={styles.eyebrowStyle}>Checkout</p><h1 style={styles.heroTitleStyle}>Choose how you want to enter EMBER.</h1><p style={styles.heroTextStyle}>Review the current price, billing interval, and included access period before opening secure checkout. EMBER includes training, nutrition targets, recovery guidance, and activity tracking. It does not include meal logging.</p><EmberPricing/></div></main></>}
