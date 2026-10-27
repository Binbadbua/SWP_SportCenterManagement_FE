// The two ways to pay for a web order (values are PaymentMethod in lib/enums.js); cash stays at the reception desk.
// Used by the package checkout and the class checkout.
export const WEB_METHODS = [
  { value: 2, title: 'Chuyển khoản ngân hàng', text: 'Chuyển khoản theo hướng dẫn của lễ tân, ghi mã giao dịch trong nội dung chuyển khoản.' },
  { value: 3, title: 'Thẻ ATM / Visa / Mastercard', text: 'Quẹt thẻ tại quầy lễ tân, đọc mã giao dịch cho lễ tân.' },
];

export default function PayMethods({ value, onChange }) {
  return (
    <div className="pay-methods" role="radiogroup" aria-label="Phương thức thanh toán">
      {WEB_METHODS.map((m) => (
        <label key={m.value} className={`pay-method ${value === m.value ? 'is-active' : ''}`}>
          <input
            type="radio"
            name="paymentMethod"
            value={m.value}
            checked={value === m.value}
            onChange={() => onChange(m.value)}
          />
          <span className="pay-method__text">
            <strong>{m.title}</strong>
            <span className="muted">{m.text}</span>
          </span>
        </label>
      ))}
    </div>
  );
}
