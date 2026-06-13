// import { useEffect, useMemo, useState } from 'react';
import { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import UserLayout from '../layouts/UserLayout';
import { formatVND, pick } from '../api';
import { bookingApi } from '../services/bookingApi';
import { promotionApi } from '../services/promotionApi';
import { paymentApi } from '../services/paymentApi';

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

function getPromotionValue(item, keys, fallback = '') {
  for (const key of keys) {
    if (item?.[key] !== undefined && item?.[key] !== null) return item[key];
  }
  return fallback;
}

function formatPromotionDate(value) {
  if (!value) return '--';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

function getPromotionTitle(item) {
  const type = Number(getPromotionValue(item, ['discountType', 'DiscountType'], 1));
  const value = Number(getPromotionValue(item, ['discountValue', 'DiscountValue'], 0));
  const maxDiscount = Number(getPromotionValue(item, ['maxDiscount', 'MaxDiscount'], 0));

  if (type === 1) {
    return `Giảm ${value}%${maxDiscount > 0 ? ` tối đa ${formatVND(maxDiscount)}` : ''}`;
  }

  return `Giảm ${formatVND(value)}`;
}

function getPromotionRules(item) {
  const minOrder = Number(getPromotionValue(item, ['minOrderValue', 'MinOrderValue'], 0));
  const remainingUses = getPromotionValue(item, ['remainingUses', 'RemainingUses'], null);
  const endDate = getPromotionValue(item, ['endDate', 'EndDate']);
  const rules = [];

  if (minOrder > 0) rules.push(`Đơn tối thiểu ${formatVND(minOrder)}`);
  rules.push(remainingUses === null ? 'Không giới hạn lượt dùng' : `Còn ${remainingUses} lượt`);
  rules.push(`Hạn đến ${formatPromotionDate(endDate)}`);
  return rules;
}

function getPromotionDescription(item) {
  return getPromotionValue(item, ['description', 'Description'], '') || 'Áp dụng theo điều kiện của chương trình ưu đãi.';
}

function getRandomItems(items, size = 3) {
  return [...items]
    .map((item) => ({ item, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .slice(0, size)
    .map(({ item }) => item);
}

export default function BookingPayment() {
  const navigate = useNavigate();
  const [pendingBooking] = useState(() => readPendingBooking());
  const [roundTripBooking] = useState(() => readRoundTripBooking());
  const [paymentMethod, setPaymentMethod] = useState('BankTransfer');
  const [submitError, setSubmitError] = useState('');
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
  const [availablePromotions, setAvailablePromotions] = useState([]);
  const [previewPromotions, setPreviewPromotions] = useState([]);
  const [showAllPromotions, setShowAllPromotions] = useState(false);
  const [selectedPromotion, setSelectedPromotion] = useState(null);
  const submittingRef = useRef(false); 
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    promotionApi.publicList()
      .then((data) => {
        const items = Array.isArray(data) ? data : [];
        setAvailablePromotions(items);
        setPreviewPromotions(getRandomItems(items, 3));
      })
      .catch(() => {
        setAvailablePromotions([]);
        setPreviewPromotions([]);
      });
  }, []);

  useEffect(() => {
    if (expiresAt > now) return;
    localStorage.removeItem(PAYMENT_EXPIRES_KEY);
    navigate(pendingBooking?.tripId ? `/trips/${pendingBooking.tripId}/seats` : '/search-results', {
      replace: true,
      state: { expiredMessage: 'Đã hết thời gian thanh toán. Vui lòng chọn lại ghế.' },
    });
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
  const promotionsToShow = previewPromotions;

  const summary = useMemo(() => ({
    route: `${pick(trip, ['departureLocation', 'DepartureLocation'], '--')} → ${pick(trip, ['arrivalLocation', 'ArrivalLocation'], '--')}`,
    departureTime: pick(trip, ['departureTime', 'DepartureTime']),
    operatorName: pick(trip, ['operatorName', 'OperatorName'], 'Nhà xe'),
    busType: pick(trip, ['busType', 'BusType'], 'Xe khách'),
  }), [trip]);

  const applyPromotion = async (selectedCode = promotionCode) => {
    const code = selectedCode.trim();
    if (!code) {
      setPromotionResult(null);
      setPromotionMessage('Vui lòng nhập mã giảm giá.');
      return;
    }

    setPromotionLoading(true);
    setPromotionMessage('');
    setPromotionCode(code);
    setSelectedPromotion(availablePromotions.find((item) => String(getPromotionValue(item, ['code', 'Code'])).toUpperCase() === code.toUpperCase()) || null);
    try {
      const result = await promotionApi.validate({
        code,
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
    // const submittingRef = useRef(false); 
  };

  // const submit = async () => {
  //    if (submittingRef.current) return;  // ← thêm
  //     submittingRef.current = true; 
  //   if (bookingsToPay.length === 0 || bookingsToPay.some((booking) => !booking?.tripId || !booking?.contact)) {
  //     alert('Thiếu dữ liệu đặt vé. Vui lòng thực hiện lại từ bước chọn ghế.');
  //     navigate('/search-results');
  //     return;
  //   }

  //   if (remainingMs <= 0) {
  //     alert('Đã hết thời gian thanh toán. Vui lòng chọn lại ghế.');
  //     navigate(`/trips/${pendingBooking.tripId}/seats`);
  //     return;
  //   }

  //   setSubmitting(true);
  //   try {
  //     const responses = [];
  //     for (let index = 0; index < bookingsToPay.length; index += 1) {
  //       const booking = bookingsToPay[index];
  //       const code = index === 0 && promotionResult ? promotionCode : '';
  //       const response = await bookingApi.create(buildBookingRequest(booking, paymentMethod, code));
  //       responses.push(response);
  //     }

  //     const bookingIds = responses
  //       .map((response) => pick(response, ['bookingID', 'bookingId', 'BookingID', 'id', 'Id']))
  //       .filter(Boolean);
  //     const bookingId = bookingIds[0];
  //     localStorage.setItem(SUCCESS_BOOKINGS_KEY, JSON.stringify(bookingIds));
  //     localStorage.removeItem(PENDING_BOOKING_KEY);
  //     localStorage.removeItem(ROUND_TRIP_KEY);
  //     localStorage.removeItem(HOLD_STORAGE_KEY);
  //     localStorage.removeItem(PAYMENT_EXPIRES_KEY);
  //     window.dispatchEvent(new Event('holdSeatUpdated'));

  //     navigate(`/booking/success/${bookingId}`, { replace: true });
  //   } catch (err) {
  //     const message = err.message || 'Không thể tạo booking.';
  //     const lowerMessage = message.toLowerCase();
  //     if (lowerMessage.includes('hết thời gian giữ') || lowerMessage.includes('het thoi gian')) {
  //       alert('Ghế đã hết thời gian giữ, vui lòng chọn lại ghế.');
  //       navigate(`/trips/${pendingBooking.tripId}/seats`);
  //       return;
  //     }

  //     alert(message);
  //   } finally {
  //     submittingRef.current = false;
  //     setSubmitting(false);
  //   }
  // };
const submit = async () => {
  if (submittingRef.current) return;
  submittingRef.current = true;
  setSubmitError('');

  if (bookingsToPay.length === 0 || bookingsToPay.some((booking) => !booking?.tripId || !booking?.contact)) {
    submittingRef.current = false;
    navigate('/search-results', { state: { expiredMessage: 'Thiếu dữ liệu đặt vé. Vui lòng thực hiện lại từ bước chọn ghế.' } });
    return;
  }

  if (remainingMs <= 0) {
    submittingRef.current = false;
    navigate(`/trips/${pendingBooking.tripId}/seats`, { state: { expiredMessage: 'Đã hết thời gian thanh toán. Vui lòng chọn lại ghế.' } });
    return;
  }

  setSubmitting(true);
  try {
    const responses = [];

    for (let index = 0; index < bookingsToPay.length; index += 1) {
      const booking = bookingsToPay[index];
      const code = index === 0 && promotionResult ? promotionCode : '';

      const response = await bookingApi.create(
        buildBookingRequest(booking, paymentMethod, code)
      );
      responses.push(response);

      // Ghi nhận thanh toán cho BankTransfer và VNPay (không phải Cash)
      if (paymentMethod === 'BankTransfer' || paymentMethod === 'VNPay') {
        await paymentApi.simulate({
          bookingID: response.bookingID || response.BookingID,
          paymentMethod,
        });
      }
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
      navigate(`/trips/${pendingBooking.tripId}/seats`, { state: { expiredMessage: 'Ghế đã hết thời gian giữ, vui lòng chọn lại ghế.' } });
      return;
    }
    setSubmitError(message);
  } finally {
    submittingRef.current = false;
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

          {paymentMethod === 'BankTransfer' && (
            <div className="payment-bank-transfer-box">
              <div className="payment-bank-qr" aria-label="QR chuyển khoản giả lập">
                <i className="fa-solid fa-qrcode" />
              </div>
              <div>
                <span>Chuyển khoản giả lập</span>
                <strong>Ngân hàng VéXeAZ Demo</strong>
                <p>Nội dung chuyển khoản: <b>VEXEAZ BookingID</b></p>
                <small>Sau khi tạo đơn, hệ thống ghi nhận đã thanh toán và đơn sẽ chờ admin xác nhận vé.</small>
              </div>
            </div>
          )}

          {paymentMethod === 'VNPay' && (
            <div className="payment-bank-transfer-box">
              <div className="payment-bank-qr" aria-label="Thanh toán ví điện tử giả lập">
                <i className="fa-solid fa-wallet" />
              </div>
              <div>
                <span>Ví điện tử giả lập</span>
                <strong>VNPay Demo</strong>
                <p>Giao dịch được ghi nhận là đã thanh toán sau khi bấm xác nhận.</p>
                <small>Vé vẫn cần admin xác nhận trước khi chuyển sang trạng thái đã xác nhận.</small>
              </div>
            </div>
          )}

          <div className="payment-promo-box">
            <div className="payment-promo-head">
              <div>
                <span>Ưu đãi</span>
                <h2>Chọn mã giảm giá</h2>
              </div>
              <button type="button" className="payment-promo-view-all" onClick={() => setShowAllPromotions(true)}>
                Xem mã giảm giá
              </button>
            </div>

            {promotionsToShow.length > 0 && (
              <div className="payment-promo-list">
                {promotionsToShow.map((item) => {
                  const code = getPromotionValue(item, ['code', 'Code']);
                  const selected = promotionCode.toUpperCase() === String(code).toUpperCase() && promotionResult;
                  return (
                    <button
                      type="button"
                      className={`payment-promo-option ${selected ? 'selected' : ''}`}
                      key={code}
                      disabled={promotionLoading}
                      onClick={() => applyPromotion(String(code))}
                    >
                      <span className="payment-promo-code">{code}</span>
                      <strong>{getPromotionTitle(item)}</strong>
                      <small>{getPromotionRules(item).join(' - ')}</small>
                    </button>
                  );
                })}
              </div>
            )}

            {selectedPromotion && (
              <div className="payment-promo-detail">
                <span>Chi tiết mã</span>
                <strong>{getPromotionValue(selectedPromotion, ['code', 'Code'])}</strong>
                <p>{getPromotionDescription(selectedPromotion)}</p>
                <ul>
                  {getPromotionRules(selectedPromotion).map((rule) => (
                    <li key={rule}>{rule}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="payment-promo-manual">
              <input
                value={promotionCode}
                onChange={(event) => {
                  setPromotionCode(event.target.value);
                  setPromotionResult(null);
                  setPromotionMessage('');
                  setSelectedPromotion(null);
                }}
                placeholder="Nhập mã giảm giá khác"
              />
              <button type="button" className="btn btn-outline" disabled={promotionLoading} onClick={() => applyPromotion()}>
                {promotionLoading ? 'Đang kiểm tra...' : 'Áp dụng'}
              </button>
            </div>
            {promotionMessage && <p className={`profile-status ${promotionResult ? 'success' : ''}`}>{promotionMessage}</p>}
          </div>

          {showAllPromotions && (
            <div className="payment-promo-modal-backdrop" role="dialog" aria-modal="true" aria-label="Danh sách mã giảm giá">
              <div className="payment-promo-modal">
                <div className="payment-promo-modal-head">
                  <div>
                    <span>Ưu đãi</span>
                    <h2>Tất cả mã giảm giá</h2>
                  </div>
                  <button type="button" onClick={() => setShowAllPromotions(false)} aria-label="Đóng danh sách mã">
                    <i className="fa-solid fa-xmark" />
                  </button>
                </div>
                <div className="payment-promo-modal-list">
                  {availablePromotions.length === 0 && (
                    <p className="payment-promo-empty">
                      Chưa có mã giảm giá khả dụng. Vui lòng kiểm tra mã đang bật, công khai, còn hạn và đã chạy script database.
                    </p>
                  )}
                  {availablePromotions.map((item) => {
                    const code = getPromotionValue(item, ['code', 'Code']);
                    const selected = promotionCode.toUpperCase() === String(code).toUpperCase() && promotionResult;
                    return (
                      <button
                        type="button"
                        className={`payment-promo-option ${selected ? 'selected' : ''}`}
                        key={code}
                        disabled={promotionLoading}
                        onClick={() => {
                          applyPromotion(String(code));
                          setShowAllPromotions(false);
                        }}
                      >
                        <span className="payment-promo-code">{code}</span>
                        <strong>{getPromotionTitle(item)}</strong>
                        <small>{getPromotionRules(item).join(' - ')}</small>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {submitError && (
            <p className="payment-submit-error" role="alert">
              <i className="fa-solid fa-circle-exclamation" /> {submitError}
            </p>
          )}

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
