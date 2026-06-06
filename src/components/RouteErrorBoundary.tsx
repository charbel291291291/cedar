import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[RouteErrorBoundary]', error, info.componentStack)
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4 p-8 text-center">
          <h1 className="text-xl font-heading font-bold">Something went wrong</h1>
          <p className="text-muted-foreground text-sm max-w-md">
            This section failed to load. You can try again or return home.
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => this.setState({ hasError: false })}>
              Try again
            </Button>
            <Button type="button" asChild>
              <Link to="/dashboard">Dashboard</Link>
            </Button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
