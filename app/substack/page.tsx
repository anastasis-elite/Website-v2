import { redirect } from 'next/navigation'

export default function SubstackRedirect() {
  redirect('/?utm_source=substack&utm_medium=bio')
}
