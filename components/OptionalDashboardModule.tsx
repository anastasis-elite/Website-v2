'use client'

import { Component, type ReactNode } from 'react'
import Link from 'next/link'

export default class OptionalDashboardModule extends Component<{
  name: string; href: string; children: ReactNode
}, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    return this.state.failed
      ? <p role="status">{this.props.name} is temporarily unavailable. <Link href={this.props.href}>Open full details</Link></p>
      : this.props.children
  }
}
