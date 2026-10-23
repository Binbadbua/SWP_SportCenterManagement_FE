import { Button } from '../components/ui.jsx';

export default function NotFound() {
  return (
    <div className="container page not-found">
      <p className="display not-found__code">404</p>
      <h1 className="not-found__title">Trang này nằm ngoài sân rồi.</h1>
      <p className="muted">Có thể đường dẫn đã cũ hoặc bị gõ sai.</p>
      <div className="not-found__actions">
        <Button to="/">Về trang chủ</Button>
        <Button to="/classes" variant="secondary">Xem các lớp học</Button>
      </div>
    </div>
  );
}
