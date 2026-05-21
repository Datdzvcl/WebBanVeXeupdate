import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import UserLayout from '../layouts/UserLayout';
import { formatVND, pick } from '../api';
import { bookingApi } from '../services/bookingApi';
import { promotionApi } from '../services/promotionApi';

const PENDING_BOOKING_KEY = 'pendingBooking';
const HOLD_STORAGE_KEY = 'currentSeatHold';
const PAYMENT_EXPIRES_KEY = 'paymentExpiresAt';
const ROUND_TRIP_KEY = 'roundTripBooking';
const SUCCESS_BOOKINGS_KEY = 'lastSuccessfulBookingIds';

const paymentMethods = [
  { value: 'Cash', label: 'Tiền mặt', icon: 'fa-money-bill-wave' },
  { value: 'BankTransfer', label: 'Chuyển khoản ngân hàng', icon: 'fa-building-columns' },
  { value: 'VNPay', label: 'Ví điện tử/VNPay giả lập', icon: 'fa-wallet' },
];

function readPendingBooking() {
  try {
    return JSON.parse(localStorage.getItem(PENDING_BOOKING_KEY) || 'null');
  } catch {
    return null;
  }
}

function readRoundTripBooking() {
  try {
    return JSON.parse(localStorage.getItem(ROUND_TRIP_KEY) || 'null');
  } catch {
    return null;
  }
}

function buildPaymentSessionKey(pendingBooking, roundTripBooking) {
  const bookings =
    roundTripBooking?.stage === 'complete' && roundTripBooking.outbound && roundTripBooking.returnTrip
      ? [roundTripBooking.outbound, roundTripBooking.returnTrip]
      : pendingBooking
        ? [pendingBooking]
        : [];

  return bookings
    .map((booking) => [
      booking?.tripId,
      (booking?.seatLabels || []).join(','),
      booking?.pickupStopId || '',
      booking?.dropoffStopId || '',
    ].join(':'))
    .join('|');
}

function buildBookingRequest(booking, paymentMethod, promotionCode) {
  return {
    tripId: booking.tripId,
    sessionId: booking.sessionId,
    customerName: booking.contact.customerName,
    customerPhone: booking.contact.customerPhone,
    customerEmail: booking.contact.customerEmail,
    seatLabels: booking.seatLabels,
    pickupStopId: booking.pickupStopId,
    dropoffStopId: booking.dropoffStopId,
    paymentMethod,
    promotionCode,
  };
}

function formatCountdown(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatDateTime(value) {
  if (!value) return '--';
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

export default function BookingPayment() {
  const navigate = useNavigate();
  const [pendingBooking] = useState(() => readPendingBooking());
  const [roundTripBooking] = useState(() => readRoundTripBooking());
  const [paymentMethod, setPaymentMethod] = useState('BankTransfer');
  const paymentSessionKey = buildPaymentSessionKey(pendingBooking, roundTripBooking);
  const [expiresAt] = useState(() => {
    let stored = null;
    try {
      stored = JSON.parse(localStorage.getItem(PAYMENT_EXPIRES_KEY) || 'null');
    } catch {
      stored = null;
    }

    if (stored?.key === paymentSessionKey && Number(stored.expiresAt) > Date.now()) {
      return Number(stored.expiresAt);
    }

    const next = Date.now() + 10 * 60 * 1000;
    localStorage.setItem(PAYMENT_EXPIRES_KEY, JSON.stringify({
      key: paymentSessionKey,
      expiresAt: next,
    }));
    return next;
  });
  const [now, setNow] = useState(Date.now());
  const [submitting, setSubmitting] = useState(false);
  const [promotionCode, setPromotionCode] = useState('');
  const [promotionResult, setPromotionResult] = useState(null);
  const [promotionMessage, setPromotionMessage] = useState('');
  const [promotionLoading, setPromotionLoading] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (expiresAt > now) return;
    alert('Đã hết thời gian thanh toán. Vui lòng chọn lại ghế.');
    localStorage.removeItem(PAYMENT_EXPIRES_KEY);
    navigate(pendingBooking?.tripId ? `/trips/${pendingBooking.tripId}/seats` : '/search-results', { replace: true });
  }, [expiresAt, navigate, now, pendingBooking?.tripId]);

  const trip = pendingBooking?.trip || {};
  const bookingsToPay = useMemo(() => {
    if (roundTripBooking?.stage === 'complete' && roundTripBooking.outbound && roundTripBooking.returnTrip) {
      return [roundTripBooking.outbound, roundTripBooking.returnTrip];
    }
    return pendingBooking ? [pendingBooking] : [];
  }, [pendingBooking, roundTripBooking]);
  const totalPrice = useMemo(
    () => bookingsToPay.reduce((sum, booking) => sum + Number(booking?.totalPrice || 0), 0),
    [bookingsToPay]
  );
  const discountAmount = Number(promotionResult?.discountAmount || promotionResult?.DiscountAmount || 0);
  const finalPrice = Math.max(0, totalPrice - discountAmount);
  const remainingMs = expiresAt - now;

  const summary = useMemo(() => ({
    route: `${pick(trip, ['departureLocation', 'DepartureLocation'], '--')} → ${pick(trip, ['arrivalLocation', 'ArrivalLocation'], '--')}`,
    departureTime: pick(trip, ['departureTime', 'DepartureTime']),
    operatorName: pick(trip, ['operatorName', 'OperatorName'], 'Nhà xe'),
    busType: pick(trip, ['busType', 'BusType'], 'Xe khách'),
  }), [trip]);

  const applyPromotion = async () => {
    if (!promotionCode.trim()) {
      setPromotionResult(null);
      setPromotionMessage('Vui lòng nhập mã giảm giá.');
      return;
    }

    setPromotionLoading(true);
    setPromotionMessage('');
    try {
      const result = await promotionApi.validate({
        code: promotionCode,
        orderValue: totalPrice,
      });
      if (result?.valid || result?.Valid) {
        setPromotionResult(result);
        setPromotionMessage(result.message || result.Message || 'Áp dụng mã thành công');
      } else {
        setPromotionResult(null);
        setPromotionMessage(result?.message || result?.Message || 'Mã giảm giá không hợp lệ.');
      }
    } catch (err) {
      setPromotionResult(null);
      setPromotionMessage(err.message || 'Không thể kiểm tra mã giảm giá.');
    } finally {
      setPromotionLoading(false);
    }
  };

  const submit = async () => {
    if (bookingsToPay.length === 0 || bookingsToPay.some((booking) => !booking?.tripId || !booking?.contact)) {
      alert('Thiếu dữ liệu đặt vé. Vui lòng thực hiện lại từ bước chọn ghế.');
      navigate('/search-results');
      return;
    }

    if (remainingMs <= 0) {
      alert('Đã hết thời gian thanh toán. Vui lòng chọn lại ghế.');
      navigate(`/trips/${pendingBooking.tripId}/seats`);
      return;
    }

    setSubmitting(true);
    try {
      const responses = [];
      for (let index = 0; index < bookingsToPay.length; index += 1) {
        const booking = bookingsToPay[index];
        const code = index === 0 && promotionResult ? promotionCode : '';
        const response = await bookingApi.create(buildBookingRequest(booking, paymentMethod, code));
        responses.push(response);
      }

      const bookingIds = responses
        .map((response) => pick(response, ['bookingID', 'bookingId', 'BookingID', 'id', 'Id']))
        .filter(Boolean);
      const bookingId = bookingIds[0];
      localStorage.setItem(SUCCESS_BOOKINGS_KEY, JSON.stringify(bookingIds));
      localStorage.removeItem(PENDING_BOOKING_KEY);
      localStorage.removeItem(ROUND_TRIP_KEY);
      localStorage.removeItem(HOLD_STORAGE_KEY);
      localStorage.removeItem(PAYMENT_EXPIRES_KEY);
      window.dispatchEvent(new Event('holdSeatUpdated'));

      navigate(`/booking/success/${bookingId}`, { replace: true });
    } catch (err) {
      const message = err.message || 'Không thể tạo booking.';
      const lowerMessage = message.toLowerCase();
      if (lowerMessage.includes('hết thời gian giữ') || lowerMessage.includes('het thoi gian')) {
        alert('Ghế đã hết thời gian giữ, vui lòng chọn lại ghế.');
        navigate(`/trips/${pendingBooking.tripId}/seats`);
        return;
      }

      alert(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!pendingBooking?.tripId) {
    return (
      <UserLayout>
        <div className="container pickup-placeholder">
          <h1>Chưa có dữ liệu thanh toán</h1>
          <p>Vui lòng chọn chuyến, giữ ghế và nhập thông tin liên hệ trước khi thanh toán.</p>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/search-results')}>
            Tìm chuyến
          </button>
        </div>
      </UserLayout>
    );
  }

  return (
    <UserLayout>
      <section className="payment-flow-hero">
        <div className="container">
          <span>Thanh toán</span>
          <h1>Hoàn tất đặt vé</h1>
          <p>Vui lòng hoàn tất thanh toán trong thời gian quy định.</p>
        </div>
      </section>

      <section className="container payment-flow-layout">
        <main className="payment-method-card">
          <div className="payment-countdown-panel">
            <div>
              <span>Thời gian thanh toán còn lại</span>
              <strong>{formatCountdown(remainingMs)}</strong>
            </div>
            <i className="fa-solid fa-clock" />
          </div>

          <h2>Chọn phương thức thanh toán</h2>
          <div className="payment-method-list">
            {paymentMethods.map((method) => (
              <label className={`payment-method-option ${paymentMethod === method.value ? 'selected' : ''}`} key={method.value}>
                <input
                  type="radio"
                  name="paymentMethod"
                  checked={paymentMethod === method.value}
                  onChange={() => setPaymentMethod(method.value)}
                />
                <i className={`fa-solid ${method.icon}`} />
                <span>{method.label}</span>
              </label>
            ))}
          </div>

          <div className="payment-promo-box">
            <h2>Mã giảm giá</h2>
            <div className="admin-filter-grid">
              <input
                value={promotionCode}
                onChange={(event) => {
                  setPromotionCode(event.target.value);
                  setPromotionResult(null);
                  setPromotionMessage('');
                }}
                placeholder="Nhập mã giảm giá"
              />
              <button type="button" className="btn btn-outline" disabled={promotionLoading} onClick={applyPromotion}>
                {promotionLoading ? 'Đang kiểm tra...' : 'Áp dụng'}
              </button>
            </div>
            {promotionMessage && <p className="profile-status">{promotionMessage}</p>}
          </div>

          <button type="button" className="btn btn-primary payment-submit-btn" disabled={submitting} onClick={submit}>
            {submitting ? 'Đang xử lý...' : 'Thanh toán'}
            <i className="fa-solid fa-arrow-right" />
          </button>
        </main>

        <aside className="payment-summary-card">
          <h2>Tóm tắt đơn</h2>
          {bookingsToPay.map((booking, index) => {
            const itemTrip = booking.trip || {};
            const itemSummary = {
              route: `${pick(itemTrip, ['departureLocation', 'DepartureLocation'], '--')} → ${pick(itemTrip, ['arrivalLocation', 'ArrivalLocation'], '--')}`,
              departureTime: pick(itemTrip, ['departureTime', 'DepartureTime']),
              operatorName: pick(itemTrip, ['operatorName', 'OperatorName'], index === 0 ? summary.operatorName : 'Nhà xe'),
              busType: pick(itemTrip, ['busType', 'BusType'], index === 0 ? summary.busType : 'Xe khách'),
            };

            return (
              <div className="payment-trip-box" key={`${booking.tripId}-${index}`}>
                <strong>{bookingsToPay.length > 1 ? (index === 0 ? 'Lượt đi' : 'Lượt về') : itemSummary.operatorName}</strong>
                {bookingsToPay.length > 1 && <span>{itemSummary.operatorName}</span>}
                <span>{itemSummary.busType}</span>
                <p>{itemSummary.route}</p>
                <small>{formatDateTime(itemSummary.departureTime)} - Ghế {booking.seatLabels?.join(', ') || '--'}</small>
              </div>
            );
          })}
          <div className="contact-summary-line">
            <span>Ghế</span>
            <strong>{bookingsToPay.map((booking) => booking.seatLabels?.join(', ') || '--').join(' / ')}</strong>
          </div>
          <div className="contact-summary-line">
            <span>Người đi</span>
            <strong>{pendingBooking.contact?.customerName || '--'}</strong>
          </div>
          <div className="contact-summary-line">
            <span>Số điện thoại</span>
            <strong>{pendingBooking.contact?.customerPhone || '--'}</strong>
          </div>
          <div className="contact-summary-total">
            <span>Tổng tiền</span>
            <strong>{formatVND(totalPrice)}</strong>
          </div>
          <div className="contact-summary-line">
            <span>Giảm giá</span>
            <strong>{formatVND(discountAmount)}</strong>
          </div>
          <div className="contact-summary-total">
            <span>Tổng thanh toán</span>
            <strong>{formatVND(finalPrice)}</strong>
          </div>
        </aside>
      </section>
    </UserLayout>
  );
}
