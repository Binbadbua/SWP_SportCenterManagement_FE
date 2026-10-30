// SePay creates a VietQR bank transfer. The website never asks for a bank card number.
export default function PayMethods({ value, onChange, methods = [2], provider = 'SePay', online = true }) {
  return (
    <div className="pay-methods" role="radiogroup" aria-label="Phương thức thanh toán">
      {methods.filter((method) => method === 2).map((method) => (
        <label key={method} className={'pay-method ' + (value === method ? 'is-active' : '')}>
          <input type="radio" name="paymentMethod" value={method} checked={value === method} onChange={() => onChange(method)} />
          <span className="pay-method__text">
            <strong>{online ? 'Chuyển khoản ngân hàng qua ' + provider : 'Chuyển khoản ngân hàng'}</strong>
            <span className="muted">{online ? 'Quét mã VietQR bằng ứng dụng ngân hàng, giữ nguyên nội dung; hệ thống tự xác nhận khi nhận được tiền.' : 'Ghi mã giao dịch trong nội dung chuyển khoản để lễ tân đối chiếu.'}</span>
          </span>
        </label>
      ))}
    </div>
  );
}
