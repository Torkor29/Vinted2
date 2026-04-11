import { type ReactNode } from 'react'

export default function PageTransition({ children }: { children: ReactNode }) {
  return (
    <div className="page-enter safe-bottom px-4 pt-4 pb-4 min-h-screen">
      {children}
    </div>
  )
}
