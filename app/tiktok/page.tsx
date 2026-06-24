import { redirect } from 'next/navigation'

export default function TikTokRedirect() {
  redirect('/?utm_source=tiktok&utm_medium=bio')
}
