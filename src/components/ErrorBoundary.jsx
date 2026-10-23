import { Component } from 'react';

// Stops one broken page from blanking the whole app.
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Page crashed:', error, info.componentStack);
  }

  // Clear the error when the user navigates to another page
  componentDidUpdate(prev) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="container page">
        <div className="empty">
          <p className="empty__title">Trang này gặp lỗi</p>
          <p className="empty__body muted">{String(this.state.error.message || this.state.error)}</p>
          <div className="empty__action">
            <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>Tải lại trang</button>
          </div>
        </div>
      </div>
    );
  }
}
