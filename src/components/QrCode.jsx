import { useEffect, useState } from 'react';

// Draws a QR code in the browser from the data the payment API gives (MoMo's qrCodeUrl); the data is not sent to
// any other service. The library loads only when a QR code is drawn (the payment page).
export default function QrCode({ value, size = 232, label }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let live = true;
    import('qrcode')
      .then(({ default: QRCode }) => QRCode.toDataURL(value, { width: size, margin: 1, errorCorrectionLevel: 'M' }))
      .then((url) => live && setSrc(url))
      .catch(() => live && setSrc(null));
    return () => {
      live = false;
    };
  }, [value, size]);
  return src ? (
    <img className="qr-code" src={src} width={size} height={size} alt={label} />
  ) : (
    <span className="qr-code qr-code--loading" style={{ width: size, height: size }} aria-hidden="true" />
  );
}
