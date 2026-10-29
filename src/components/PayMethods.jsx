// The ways a member pays for an order made on the website (values are PaymentMethod in lib/enums.js): online only,
// never at the desk. Once the API takes MoMo (CHANGELOG Part B, B54) the money is checked by MoMo; before that a bank
// transfer is checked by reception. Used by the package, class and upgrade checkouts with usePaymentOptions().methods.
const METHODS = {
  2: { title: 'Chuyển khoản ngân hàng', text: 'Chuyển khoản qua ứng dụng ngân hàng, ghi mã giao dịch trong nội dung; lễ tân đối soát rồi xác nhận.' },
  4: { title: 'Ví MoMo', text: 'Quét mã QR bằng ứng dụng MoMo, hoặc mở thẳng ứng dụng MoMo nếu bạn đang dùng điện thoại.' },
  5: { title: 'Thẻ ATM nội địa (qua MoMo)', text: 'Nhập thẻ ATM có đăng ký thanh toán trực tuyến trên trang thanh toán của MoMo.' },
};

export default function PayMethods({ value, onChange, methods = [2] }) {
  return (
    <div className="pay-methods" role="radiogroup" aria-label="Phương thức thanh toán">
      {methods.filter((m) => METHODS[m]).map((m) => (
        <label key={m} className={`pay-method ${value === m ? 'is-active' : ''}`}>
          <input type="radio" name="paymentMethod" value={m} checked={value === m} onChange={() => onChange(m)} />
          <span className="pay-method__text">
            <strong>{METHODS[m].title}</strong>
            <span className="muted">{METHODS[m].text}</span>
          </span>
        </label>
      ))}
    </div>
  );
}
