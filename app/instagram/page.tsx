import { redirect } from 'next/navigation'

export default function InstagramRedirect() {
  redirect('/?utm_source=instagram&utm_medium=bio')
}
