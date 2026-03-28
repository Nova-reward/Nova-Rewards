import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Dashboard error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="container" style={{ marginTop: '2rem' }}>
          <div className="card" style={{ textAlign: 'center', borderColor: '#dc2626' }}>
            <h2 style={{ color: '#dc2626', marginBottom: '1rem' }}>
              ⚠️ Something went wrong
            </h2>
            <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>
              We encountered an error loading your dashboard. This might be a temporary issue with the blockchain network.
            </p>
            <button
              className="btn btn-primary"
              onClick={this.handleRetry}
              style={{ marginRight: '0.75rem' }}
            >
              Retry
            </button>
            <a href="/" className="btn btn-secondary" style={{ display: 'inline-block' }}>
              Go Home
            </a>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
