import { redirect } from 'next/navigation'

export default function YouTubeRedirect() {
  redirect('/?utm_source=youtube&utm_medium=bio')
}
