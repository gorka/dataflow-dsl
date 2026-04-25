import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error: error.message };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: 16,
          padding: 32,
          color: '#ccc',
          fontFamily: 'system-ui, sans-serif',
        }}>
          <div style={{ color: '#f04747', fontWeight: 600, fontSize: 16 }}>Something went wrong</div>
          <pre style={{
            color: '#f04747',
            fontSize: 12,
            fontFamily: 'monospace',
            background: '#1a1a2e',
            padding: 16,
            borderRadius: 6,
            maxWidth: 600,
            whiteSpace: 'pre-wrap',
          }}>{this.state.error}</pre>
          <button
            onClick={() => this.setState({ error: null })}
            style={{
              background: '#5865f2',
              color: '#fff',
              border: 'none',
              padding: '8px 20px',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            Recover
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
