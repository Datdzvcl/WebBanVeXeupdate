import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import UserLayout from '../layouts/UserLayout';
import { formatVND, labelBookingStatus, labelPaymentStatus, pick } from '../api';
import { bookingApi } from '../services/bookingApi';

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

function statusClass(status) {
  return `ticket-status status-${String(status || '').toLowerCase()}`;
}

export default function MyTickets() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionId, setActionId] = useState(null);

  const loadBookings = async () => {
    setLoading(true);
    setError('');
    try {
      // const data = await bookingApi.my();
      // setBookings(Array.isArray(data) ? data : []);
      const data = await bookingApi.my();
      const all = Array.isArray(data) ? data : [];
      // Chỉ giữ vé còn hiệu lực: PendingConfirm(0), Confirmed(1), CancelRequested(5), CancelRejected(6)
      const activeOnly = all.filter(b => {
        const bs = Number(b.bookingStatus ?? b.BookingStatus ?? 0);
        return bs === 0 || bs === 1 || bs === 5 || bs === 6;
      });
      setBookings(activeOnly);
    } catch (err) {
      setError(err.message || 'Không tải được danh sách vé.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBookings();
  }, []);

  const requestCancel = async (bookingId) => {
    const reason = window.prompt('Nhập lý do yêu cầu hủy vé:', 'Khách yêu cầu hủy vé');
    if (reason === null) return;

    setActionId(bookingId);
    try {
      await bookingApi.requestCancel(bookingId, { cancelReason: reason });
      await loadBookings();
      alert('Đã gửi yêu cầu hủy vé.');
    } catch (err) {
      alert(err.message || 'Không thể gửi yêu cầu hủy vé.');
    } finally {
      setActionId(null);
    }
  };

  return (
    <UserLayout>
      <main className="account-page">
        <section className="account-panel my-ticket-panel">
          <div className="account-head">
            <div>
              <h1>Vé của tôi</h1>
              <p>Theo dõi các vé đã đặt bằng tài khoản hiện tại.</p>
            </div>
            <Link className="btn btn-primary" to="/search-results">Đặt vé mới</Link>
          </div>

          {loading && <p className="muted">Đang tải vé...</p>}
          {error && <p className="profile-status">{error}</p>}

          {!loading && !error && bookings.length === 0 && (
            <div className="empty-state">
              <i className="fa-solid fa-ticket" />
              <h3>Chưa có vé nào</h3>
              <p>Các vé đã đặt bằng tài khoản này sẽ hiển thị tại đây.</p>
            </div>
          )}

          <div className="my-ticket-list">
            {bookings.map((item) => {
              // const bookingId = pick(item, ['bookingID', 'BookingID', 'bookingId', 'id']);
              // const paymentStatus = pick(item, ['paymentStatus', 'PaymentStatus'], '--');
              // const bookingStatus = pick(item, ['bookingStatus', 'BookingStatus'], '--');
              // const seatLabels = pick(item, ['seatLabels', 'SeatLabels'], []);
              // const cancelReason = pick(item, ['cancelReason', 'CancelReason'], '');
              // const refundAmount = pick(item, ['refundAmount', 'RefundAmount'], null);
              // const canRequestCancel = !['Cancelled', 'CancelRequested', 'CancelRejected'].includes(String(bookingStatus));
              // const hasReview = Boolean(pick(item, ['hasReview', 'HasReview'], false));
              // const arrivalTime = pick(item, ['arrivalTime', 'ArrivalTime']);
              // const canReview = !hasReview &&
              //   !['Cancelled', 'CancelRequested'].includes(String(bookingStatus)) &&
              //   arrivalTime &&
              //   new Date(arrivalTime) <= new Date();
              const bookingId    = pick(item, ['bookingID', 'BookingID', 'bookingId', 'id']);
              const bookingStatus = Number(pick(item, ['bookingStatus', 'BookingStatus'], 0));
              const seatLabels   = pick(item, ['seatLabels', 'SeatLabels'], []);
              const cancelReason = pick(item, ['cancelReason', 'CancelReason'], '');
              const refundAmount = pick(item, ['refundAmount', 'RefundAmount'], null);
              const hasReview    = Boolean(pick(item, ['hasReview', 'HasReview'], false));
              const arrivalTime  = pick(item, ['arrivalTime', 'ArrivalTime']);

              // Dùng số theo enum: 2=Cancelled, 5=CancelRequested, 6=CancelRejected
              const canRequestCancel = bookingStatus !== 2
                                    && bookingStatus !== 4 
                                    && bookingStatus !== 5
                                    && bookingStatus !== 6;

              const canReview = !hasReview
                // && bookingStatus !== 2   // Cancelled
                // && bookingStatus !== 5   // CancelRequested
                && bookingStatus === 3
                && arrivalTime
                && new Date(arrivalTime) <= new Date();

              return (
                <article className="my-ticket-card" key={bookingId}>
                  <div className="my-ticket-main">
                    <div>
                      <span className="ticket-code">Mã vé #{bookingId}</span>
                      <h2>{pick(item, ['operatorName', 'OperatorName'], 'Nhà xe')}</h2>
                      <p>{pick(item, ['route', 'Route'], `${pick(item, ['departureLocation', 'DepartureLocation'], '--')} → ${pick(item, ['arrivalLocation', 'ArrivalLocation'], '--')}`)}</p>
                    </div>
                    <div className="my-ticket-meta">
                      <span><i className="fa-solid fa-calendar-days" /> {formatDateTime(pick(item, ['departureTime', 'DepartureTime']))}</span>
                      <span><i className="fa-solid fa-couch" /> {Array.isArray(seatLabels) ? seatLabels.join(', ') : seatLabels}</span>
                      <span><i className="fa-solid fa-money-bill" /> {formatVND(pick(item, ['totalPrice', 'TotalPrice'], 0))}</span>
                    </div>
                  </div>

                  <div className="my-ticket-side">
                    {/* <span className={statusClass(paymentStatus)}>{labelPaymentStatus(paymentStatus)}</span> */}
                    {/* <span className={statusClass(bookingStatus)}>{labelPaymentStatus(bookingStatus)}</span> */}
                    <span className={statusClass(bookingStatus)}>{labelBookingStatus(bookingStatus)}</span>
                    {cancelReason && <small>Lý do hủy: {cancelReason}</small>}
                    {refundAmount !== null && refundAmount !== undefined && <small>Hoàn tiền: {formatVND(refundAmount)}</small>}
                    <Link className="btn btn-outline" to={`/my-tickets/${bookingId}`}>Xem chi tiết</Link>
                    {hasReview ? (
                      <span className="ticket-status status-confirmed">Đã đánh giá</span>
                    ) : canReview ? (
                      <Link className="btn btn-primary" to={`/my-tickets/${bookingId}`}>Đánh giá</Link>
                    ) : null}
                    {/* <button
                      type="button"
                      className="btn btn-danger"
                      disabled={!canRequestCancel || actionId === bookingId}
                      onClick={() => requestCancel(bookingId)}
                    >
                      {bookingStatus === 5 ? 'Đã yêu cầu hủy' : 'Yêu cầu hủy vé'}
                    </button> */}
                    {canRequestCancel && (
                      <button
                        type="button"
                        className="btn btn-danger"
                        disabled={actionId === bookingId}
                        onClick={() => requestCancel(bookingId)}
                      >
                        Yêu cầu hủy vé
                      </button>
                    )}
                    {bookingStatus === 5 && (
                      <span className="ticket-status status-pending">Đang chờ duyệt hủy</span>
                    )}
                    {bookingStatus === 6 && (
                      <span className="ticket-status status-cancelled">Từ chối hủy</span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </main>
    </UserLayout>
  );
}
