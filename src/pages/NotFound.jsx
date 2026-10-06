import { Button } from '../components/ui.jsx';

export default function NotFound() {
  return (
    <div className="container page not-found">
      <p className="display not-found__code">404</p>
      <h1 className="not-found__title">This page is out of bounds.</h1>
      <p className="muted">The link may be old or mistyped.</p>
      <div className="not-found__actions">
        <Button to="/">Go to the home page</Button>
        <Button to="/classes" variant="secondary">Browse classes</Button>
      </div>
    </div>
  );
}
