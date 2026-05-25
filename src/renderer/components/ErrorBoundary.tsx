import React from 'react'
import { Alert, Button, Container } from 'react-bootstrap'

interface Props {
  children: React.ReactNode
}

interface State {
  error: Error | null
}

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <Container className="d-flex flex-column align-items-center justify-content-center vh-100">
          <Alert variant="danger" className="w-100" style={{ maxWidth: 600 }}>
            <Alert.Heading>Something went wrong</Alert.Heading>
            <pre className="small mb-3">{this.state.error.message}</pre>
            <Button variant="outline-danger" onClick={() => window.location.reload()}>
              Reload
            </Button>
          </Alert>
        </Container>
      )
    }
    return this.props.children
  }
}
