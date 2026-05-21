using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using BaseCore.Entities;
using BaseCore.Repository;
using System.Data;
using System.Security.Claims;

namespace BaseCore.APIService.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class BookingsController : ControllerBase
    {
        private const string HoldingStatus = "Holding";
        private const string ExpiredStatus = "Expired";
        private const string ConvertedToBookingStatus = "ConvertedToBooking";
        private const string BookingPendingConfirmStatus = "PendingConfirm";
        private const string BookingConfirmedStatus = "Confirmed";
        private const string BookingCancelRequestedStatus = "CancelRequested";
        private const string BookingCancelledStatus = "Cancelled";
        private const string BookingCancelRejectedStatus = "CancelRejected";
        private const string PaymentPaidStatus = "Paid";
        private const string PaymentPendingStatus = "Pending";
        private const string PaymentCancelledStatus = "Cancelled";
        private const string PaymentRefundedStatus = "Refunded";

        private readonly MySqlDbContext _context;

        public BookingsController(MySqlDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetAll(
            int? bookingId,
            string? customerName,
            string? customerPhone,
            int? operatorId,
            string? routeKeyword,
            string? paymentStatus,
            string? bookingStatus,
            DateTime? fromDate,
            DateTime? toDate,
            int page = 1,
            int pageSize = 10)
        {
            page = page <= 0 ? 1 : page;
            pageSize = pageSize <= 0 ? 10 : Math.Min(pageSize, 100);

            var query = _context.Bookings
                .AsNoTracking()
                .Include(x => x.Trip).ThenInclude(x => x.Bus).ThenInclude(x => x.Operator)
                .Include(x => x.TicketSeats)
                .AsQueryable();

            if (bookingId.HasValue)
                query = query.Where(x => x.BookingID == bookingId.Value);

            if (!string.IsNullOrWhiteSpace(customerName))
            {
                var keyword = customerName.Trim();
                query = query.Where(x => x.CustomerName != null && x.CustomerName.Contains(keyword));
            }

            if (!string.IsNullOrWhiteSpace(customerPhone))
            {
                var keyword = customerPhone.Trim();
                query = query.Where(x => x.CustomerPhone != null && x.CustomerPhone.Contains(keyword));
            }

            if (operatorId.HasValue)
                query = query.Where(x => x.Trip != null && x.Trip.Bus != null && x.Trip.Bus.OperatorID == operatorId.Value);

            if (!string.IsNullOrWhiteSpace(routeKeyword))
            {
                var keyword = routeKeyword.Trim();
                query = query.Where(x =>
                    x.Trip != null &&
                    ((x.Trip.DepartureLocation != null && x.Trip.DepartureLocation.Contains(keyword)) ||
                     (x.Trip.ArrivalLocation != null && x.Trip.ArrivalLocation.Contains(keyword))));
            }

            if (!string.IsNullOrWhiteSpace(paymentStatus))
            {
                var status = paymentStatus.Trim();
                query = query.Where(x => x.PaymentStatus == status);
            }

            if (!string.IsNullOrWhiteSpace(bookingStatus))
            {
                var status = bookingStatus.Trim();
                query = query.Where(x => x.BookingStatus == status || (x.BookingStatus == null && status == "PendingConfirm"));
            }

            if (fromDate.HasValue)
            {
                var start = fromDate.Value.Date;
                query = query.Where(x => x.BookingDate >= start);
            }

            if (toDate.HasValue)
            {
                var end = toDate.Value.Date.AddDays(1);
                query = query.Where(x => x.BookingDate < end);
            }

            var totalCount = await query.CountAsync();
            var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);

            var items = await query
                .OrderByDescending(x => x.BookingDate)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(x => new
                {
                    bookingID = x.BookingID,
                    operatorID = x.Trip == null || x.Trip.Bus == null ? (int?)null : x.Trip.Bus.OperatorID,
                    operatorName = x.Trip != null && x.Trip.Bus != null && x.Trip.Bus.Operator != null
                        ? x.Trip.Bus.Operator.Name
                        : null,
                    departureLocation = x.Trip == null ? null : x.Trip.DepartureLocation,
                    arrivalLocation = x.Trip == null ? null : x.Trip.ArrivalLocation,
                    departureTime = x.Trip == null ? (DateTime?)null : x.Trip.DepartureTime,
                    arrivalTime = x.Trip == null ? (DateTime?)null : x.Trip.ArrivalTime,
                    customerName = x.CustomerName,
                    customerPhone = x.CustomerPhone,
                    customerEmail = x.CustomerEmail,
                    totalSeats = x.TotalSeats,
                    totalPrice = x.TotalPrice,
                    promotionID = x.PromotionID,
                    discountAmount = x.DiscountAmount,
                    paymentMethod = x.PaymentMethod,
                    paymentStatus = x.PaymentStatus,
                    bookingStatus = x.BookingStatus ?? BookingPendingConfirmStatus,
                    bookingDate = x.BookingDate,
                    cancelReason = x.CancelReason,
                    cancelledAt = x.CancelledAt,
                    refundAmount = x.RefundAmount,
                    seatLabels = x.TicketSeats == null
                        ? new List<string>()
                        : x.TicketSeats.Select(s => s.SeatLabel).ToList()
                })
                .ToListAsync();

            return Ok(new
            {
                items,
                totalCount,
                page,
                pageSize,
                totalPages
            });
        }

        [HttpGet("my")]
        [Authorize]
        public async Task<IActionResult> GetMyBookings()
        {
            var currentUserId = GetCurrentUserId();
            if (!currentUserId.HasValue)
                return Unauthorized(new { message = "Token không hợp lệ" });

            var bookings = await _context.Bookings
                .AsNoTracking()
                .Include(x => x.Trip).ThenInclude(x => x.Bus).ThenInclude(x => x.Operator)
                .Include(x => x.TicketSeats)
                .Where(x => x.UserID == currentUserId.Value)
                .OrderByDescending(x => x.BookingDate)
                .Select(x => new
                {
                    bookingID = x.BookingID,
                    operatorName = x.Trip != null && x.Trip.Bus != null && x.Trip.Bus.Operator != null
                        ? x.Trip.Bus.Operator.Name
                        : null,
                    route = x.Trip == null ? null : $"{x.Trip.DepartureLocation} - {x.Trip.ArrivalLocation}",
                    departureLocation = x.Trip == null ? null : x.Trip.DepartureLocation,
                    arrivalLocation = x.Trip == null ? null : x.Trip.ArrivalLocation,
                    departureTime = x.Trip == null ? (DateTime?)null : x.Trip.DepartureTime,
                    seatLabels = x.TicketSeats == null
                        ? new List<string>()
                        : x.TicketSeats.Select(s => s.SeatLabel).ToList(),
                    totalPrice = x.TotalPrice,
                    promotionID = x.PromotionID,
                    discountAmount = x.DiscountAmount,
                    paymentStatus = x.PaymentStatus,
                    bookingStatus = x.BookingStatus ?? BookingPendingConfirmStatus,
                    cancelReason = x.CancelReason,
                    cancelledAt = x.CancelledAt,
                    refundAmount = x.RefundAmount,
                    pickupStop = _context.StopPoints
                        .Where(s => s.StopPointID == x.PickupStopID)
                        .Select(s => new { s.StopPointID, s.StopName, s.StopAddress, s.StopType })
                        .FirstOrDefault(),
                    dropoffStop = _context.StopPoints
                        .Where(s => s.StopPointID == x.DropoffStopID)
                        .Select(s => new { s.StopPointID, s.StopName, s.StopAddress, s.StopType })
                        .FirstOrDefault()
                })
                .ToListAsync();

            return Ok(bookings);
        }

        [HttpGet("{id}")]
        [AllowAnonymous]
        public async Task<IActionResult> GetById(int id)
        {
            var booking = await _context.Bookings
                .AsNoTracking()
                .Include(x => x.Trip).ThenInclude(x => x.Bus).ThenInclude(x => x.Operator)
                .Include(x => x.TicketSeats)
                .Where(x => x.BookingID == id)
                .Select(x => new
                {
                    bookingID = x.BookingID,
                    tripID = x.TripID,
                    userID = x.UserID,
                    customerName = x.CustomerName,
                    customerPhone = x.CustomerPhone,
                    customerEmail = x.CustomerEmail,
                    totalSeats = x.TotalSeats,
                    totalPrice = x.TotalPrice,
                    promotionID = x.PromotionID,
                    discountAmount = x.DiscountAmount,
                    paymentMethod = x.PaymentMethod,
                    paymentStatus = x.PaymentStatus,
                    bookingStatus = x.BookingStatus ?? "PendingConfirm",
                    bookingDate = x.BookingDate,
                    pickupStopID = x.PickupStopID,
                    dropoffStopID = x.DropoffStopID,
                    cancelReason = x.CancelReason,
                    cancelledAt = x.CancelledAt,
                    refundAmount = x.RefundAmount,
                    operatorName = x.Trip != null && x.Trip.Bus != null && x.Trip.Bus.Operator != null
                        ? x.Trip.Bus.Operator.Name
                        : null,
                    departureLocation = x.Trip == null ? null : x.Trip.DepartureLocation,
                    arrivalLocation = x.Trip == null ? null : x.Trip.ArrivalLocation,
                    departureTime = x.Trip == null ? (DateTime?)null : x.Trip.DepartureTime,
                    arrivalTime = x.Trip == null ? (DateTime?)null : x.Trip.ArrivalTime,
                    trip = x.Trip == null ? null : new
                    {
                        x.Trip.TripID,
                        x.Trip.DepartureLocation,
                        x.Trip.ArrivalLocation,
                        x.Trip.DepartureTime,
                        x.Trip.ArrivalTime,
                        x.Trip.Price,
                        x.Trip.Status
                    },
                    bus = x.Trip == null || x.Trip.Bus == null ? null : new
                    {
                        x.Trip.Bus.BusID,
                        x.Trip.Bus.LicensePlate,
                        x.Trip.Bus.Capacity,
                        x.Trip.Bus.BusType
                    },
                    operatorInfo = x.Trip == null || x.Trip.Bus == null || x.Trip.Bus.Operator == null ? null : new
                    {
                        x.Trip.Bus.Operator.OperatorID,
                        x.Trip.Bus.Operator.Name,
                        x.Trip.Bus.Operator.ContactPhone,
                        x.Trip.Bus.Operator.Email
                    },
                    seatLabels = x.TicketSeats == null
                        ? new List<string>()
                        : x.TicketSeats.Select(s => s.SeatLabel).ToList(),
                    ticketSeats = x.TicketSeats == null
                        ? new List<TicketSeatInfoResponse>()
                        : x.TicketSeats.Select(s => new
                        {
                            s.TicketSeatID,
                            s.SeatLabel,
                            s.QRCode
                        }).Select(s => new TicketSeatInfoResponse
                        {
                            TicketSeatID = s.TicketSeatID,
                            SeatLabel = s.SeatLabel,
                            QRCode = s.QRCode
                        }).ToList(),
                    qrCodes = x.TicketSeats == null
                        ? new List<string?>()
                        : x.TicketSeats.Select(s => s.QRCode).ToList(),
                    pickupStop = _context.StopPoints
                        .Where(s => s.StopPointID == x.PickupStopID)
                        .Select(s => new { s.StopPointID, s.StopName, s.StopAddress, s.StopType })
                        .FirstOrDefault(),
                    dropoffStop = _context.StopPoints
                        .Where(s => s.StopPointID == x.DropoffStopID)
                        .Select(s => new { s.StopPointID, s.StopName, s.StopAddress, s.StopType })
                        .FirstOrDefault()
                })
                .FirstOrDefaultAsync();

            if (booking == null)
                return NotFound();

            return Ok(booking);
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateBookingRequest request)
        {
            var currentUserId = GetCurrentUserId();
            var sessionId = NormalizeSessionId(request.SessionId);

            if (!currentUserId.HasValue && string.IsNullOrWhiteSpace(sessionId))
                return BadRequest(new { message = "Cần sessionId nếu chưa đăng nhập" });

            var seatLabels = NormalizeSeatLabels(request.SeatLabels);
            if (request.TripId <= 0 || seatLabels.Count == 0)
                return BadRequest(new { message = "TripId và danh sách ghế là bắt buộc" });

            if (string.IsNullOrWhiteSpace(request.CustomerName) || string.IsNullOrWhiteSpace(request.CustomerPhone))
                return BadRequest(new { message = "Tên khách hàng và số điện thoại là bắt buộc" });

            await using var transaction = await _context.Database.BeginTransactionAsync(IsolationLevel.Serializable);

            try
            {
                var trip = await _context.Trips
                    .Include(x => x.Bus)
                    .FirstOrDefaultAsync(x => x.TripID == request.TripId);

                if (trip == null)
                    return NotFound(new { message = "Không tìm thấy chuyến xe" });

                if (!request.PickupStopId.HasValue || !request.DropoffStopId.HasValue)
                    return BadRequest(new { message = "Điểm đón và điểm trả là bắt buộc" });

                var pickupStopValid = await _context.StopPoints.AnyAsync(x =>
                    x.StopPointID == request.PickupStopId.Value &&
                    x.TripID == request.TripId &&
                    x.IsActive &&
                    (x.StopType == 1 || x.StopType == 3));

                if (!pickupStopValid)
                    return BadRequest(new { message = "Điểm đón không hợp lệ cho chuyến xe này" });

                var dropoffStopValid = await _context.StopPoints.AnyAsync(x =>
                    x.StopPointID == request.DropoffStopId.Value &&
                    x.TripID == request.TripId &&
                    x.IsActive &&
                    (x.StopType == 2 || x.StopType == 3));

                if (!dropoffStopValid)
                    return BadRequest(new { message = "Điểm trả không hợp lệ cho chuyến xe này" });

                if (trip.AvailableSeats < seatLabels.Count)
                    return Conflict(new { message = "Không đủ chỗ trống" });

                var now = DateTime.Now;
                var expiredHolds = await _context.SeatHolds
                    .Where(x =>
                        x.TripID == request.TripId &&
                        x.Status == HoldingStatus &&
                        x.HoldExpiresAt <= now &&
                        seatLabels.Contains(x.SeatLabel.ToUpper()))
                    .ToListAsync();

                foreach (var expiredHold in expiredHolds)
                {
                    expiredHold.Status = ExpiredStatus;
                }

                if (expiredHolds.Count > 0)
                    await _context.SaveChangesAsync();

                var holds = await _context.SeatHolds
                    .Where(x =>
                        x.TripID == request.TripId &&
                        x.Status == HoldingStatus &&
                        x.HoldExpiresAt > now &&
                        seatLabels.Contains(x.SeatLabel.ToUpper()))
                    .ToListAsync();

                var ownedHoldSeats = holds
                    .Where(x => IsOwnedByCurrent(x.UserID, x.SessionId, currentUserId, sessionId))
                    .Select(x => NormalizeSeatLabel(x.SeatLabel))
                    .Distinct()
                    .ToHashSet();

                var missingHoldSeats = seatLabels.Where(x => !ownedHoldSeats.Contains(x)).ToList();
                if (missingHoldSeats.Count > 0)
                {
                    return Conflict(new
                    {
                        message = "Ghế đã hết thời gian giữ, vui lòng chọn lại.",
                        seats = missingHoldSeats
                    });
                }

                var bookedSeats = await _context.TicketSeats
                    .Include(x => x.Booking)
                    .Where(x =>
                        x.Booking != null &&
                        x.Booking.TripID == request.TripId &&
                        (x.Booking.PaymentStatus == null || x.Booking.PaymentStatus != "Cancelled") &&
                        (x.Booking.BookingStatus == null || x.Booking.BookingStatus != "Cancelled") &&
                        seatLabels.Contains(x.SeatLabel.ToUpper()))
                    .Select(x => x.SeatLabel)
                    .ToListAsync();

                var bookedSeatSet = bookedSeats
                    .Select(NormalizeSeatLabel)
                    .Distinct()
                    .ToList();

                if (bookedSeatSet.Count > 0)
                    return Conflict(new { message = $"Ghế đã được đặt: {string.Join(", ", bookedSeatSet)}" });

                var totalSeats = seatLabels.Count;
                var subtotal = totalSeats * trip.Price;
                int? promotionId = null;
                decimal discountAmount = 0;
                var totalPrice = subtotal;
                Promotion? promotion = null;

                var promotionCode = NormalizeOptionalText(request.PromotionCode);
                if (!string.IsNullOrWhiteSpace(promotionCode))
                {
                    promotion = await _context.Promotions
                        .FirstOrDefaultAsync(x => x.Code == promotionCode.Trim().ToUpper());

                    if (promotion == null)
                        return BadRequest(new { message = "Ma giam gia khong ton tai" });

                    var promotionResult = PromotionsController.ValidatePromotionEntity(
                        promotion,
                        subtotal,
                        currentUserId,
                        now);

                    if (!promotionResult.Valid)
                        return BadRequest(new { message = promotionResult.Message });

                    promotionId = promotionResult.PromotionId;
                    discountAmount = promotionResult.DiscountAmount;
                    totalPrice = promotionResult.FinalAmount;
                }

                var booking = new Booking
                {
                    TripID = request.TripId,
                    UserID = currentUserId,
                    CustomerName = request.CustomerName.Trim(),
                    CustomerPhone = request.CustomerPhone.Trim(),
                    CustomerEmail = NormalizeOptionalText(request.CustomerEmail),
                    TotalSeats = totalSeats,
                    TotalPrice = totalPrice,
                    PromotionID = promotionId,
                    DiscountAmount = discountAmount,
                    PaymentMethod = NormalizeOptionalText(request.PaymentMethod) ?? "Chuyển khoản",
                    PaymentStatus = "Paid",
                    BookingStatus = "PendingConfirm",
                    BookingDate = now,
                    PickupStopID = request.PickupStopId,
                    DropoffStopID = request.DropoffStopId
                };

                _context.Bookings.Add(booking);
                await _context.SaveChangesAsync();

                foreach (var seatLabel in seatLabels)
                {
                    _context.TicketSeats.Add(new TicketSeat
                    {
                        BookingID = booking.BookingID,
                        SeatLabel = seatLabel,
                        QRCode = $"BOOKING:{booking.BookingID};TRIP:{booking.TripID};SEAT:{seatLabel};PHONE:{booking.CustomerPhone}"
                    });
                }

                foreach (var hold in holds.Where(x => ownedHoldSeats.Contains(NormalizeSeatLabel(x.SeatLabel))))
                {
                    hold.Status = ConvertedToBookingStatus;
                    hold.BookingID = booking.BookingID;
                }

                trip.AvailableSeats -= totalSeats;
                if (promotion != null)
                    promotion.UsedCount += 1;

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new
                {
                    bookingID = booking.BookingID,
                    bookingStatus = booking.BookingStatus,
                    booking.TripID,
                    booking.UserID,
                    booking.CustomerName,
                    booking.CustomerPhone,
                    booking.CustomerEmail,
                    booking.TotalSeats,
                    subtotal,
                    booking.DiscountAmount,
                    booking.TotalPrice,
                    booking.PromotionID,
                    booking.PaymentMethod,
                    booking.PaymentStatus,
                    booking.BookingDate,
                    booking.PickupStopID,
                    booking.DropoffStopID,
                    seatLabels
                });
            }
            catch (DbUpdateException)
            {
                await transaction.RollbackAsync();
                return Conflict(new { message = "Không thể tạo booking vì trạng thái ghế vừa thay đổi. Vui lòng chọn lại." });
            }
        }

        [HttpPut("{id}/payment-status")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> UpdatePaymentStatus(int id, [FromBody] string status)
        {
            var booking = await _context.Bookings.FindAsync(id);

            if (booking == null)
                return NotFound();

            booking.PaymentStatus = status;
            await _context.SaveChangesAsync();

            return Ok(new { booking.BookingID, booking.PaymentStatus });
        }

        [HttpPut("{id}/confirm")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> Confirm(int id)
        {
            var booking = await _context.Bookings.FindAsync(id);

            if (booking == null)
                return NotFound(new { message = "Khong tim thay booking" });

            var currentStatus = booking.BookingStatus ?? BookingPendingConfirmStatus;
            if (currentStatus != BookingPendingConfirmStatus)
                return BadRequest(new { message = "Chi co the xac nhan don co BookingStatus = PendingConfirm" });

            booking.BookingStatus = BookingConfirmedStatus;
            await _context.SaveChangesAsync();

            return Ok(new
            {
                bookingID = booking.BookingID,
                bookingStatus = booking.BookingStatus,
                message = "Da xac nhan don dat ve"
            });
        }

        [HttpPut("{id}/approve-cancel")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> ApproveCancel(int id, [FromBody] ApproveCancelBookingRequest? request)
        {
            await using var transaction = await _context.Database.BeginTransactionAsync(IsolationLevel.Serializable);

            var booking = await _context.Bookings
                .Include(x => x.Trip)
                .Include(x => x.TicketSeats)
                .FirstOrDefaultAsync(x => x.BookingID == id);

            if (booking == null)
                return NotFound(new { message = "Khong tim thay booking" });

            var currentStatus = booking.BookingStatus ?? BookingPendingConfirmStatus;
            if (currentStatus != BookingCancelRequestedStatus)
                return BadRequest(new { message = "Chi co the duyet huy don co BookingStatus = CancelRequested" });

            var now = DateTime.Now;
            if (booking.Trip != null && IsTripDepartedOrCompleted(booking.Trip, now))
                return BadRequest(new { message = "Chuyen xe da chay hoac da hoan thanh, khong the duyet huy." });

            var refundRate = CalculateRefundRate(booking.Trip?.DepartureTime, now);
            var isPaid = string.Equals(booking.PaymentStatus, PaymentPaidStatus, StringComparison.OrdinalIgnoreCase);
            var refundAmount = isPaid ? Math.Round(booking.TotalPrice * refundRate, 0) : 0m;

            booking.BookingStatus = BookingCancelledStatus;
            booking.PaymentStatus = isPaid ? PaymentRefundedStatus : PaymentCancelledStatus;
            booking.CancelledAt = now;
            booking.RefundAmount = refundAmount;

            if (booking.Trip != null && booking.TotalSeats > 0 && booking.Trip.DepartureTime > now)
                booking.Trip.AvailableSeats += booking.TotalSeats;

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            return Ok(new
            {
                bookingID = booking.BookingID,
                bookingStatus = booking.BookingStatus,
                paymentStatus = booking.PaymentStatus,
                booking.CancelledAt,
                booking.RefundAmount,
                refundRate,
                seatsRestored = booking.TotalSeats,
                message = "Da duyet huy don dat ve"
            });
        }

        [HttpPut("{id}/reject-cancel")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> RejectCancel(int id, [FromBody] RejectCancelBookingRequest? request)
        {
            var booking = await _context.Bookings.FindAsync(id);

            if (booking == null)
                return NotFound(new { message = "Khong tim thay booking" });

            var currentStatus = booking.BookingStatus ?? BookingPendingConfirmStatus;
            if (currentStatus != BookingCancelRequestedStatus)
                return BadRequest(new { message = "Chi co the tu choi huy don co BookingStatus = CancelRequested" });

            booking.BookingStatus = BookingCancelRejectedStatus;

            await _context.SaveChangesAsync();

            return Ok(new
            {
                bookingID = booking.BookingID,
                bookingStatus = booking.BookingStatus,
                rejectReason = NormalizeOptionalText(request?.RejectReason),
                message = "Da tu choi yeu cau huy don"
            });
        }

        [HttpPut("{id}/cancel")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> Cancel(int id)
        {
            var booking = await _context.Bookings
                .Include(b => b.Trip)
                .FirstOrDefaultAsync(b => b.BookingID == id);

            if (booking == null)
                return NotFound();

            if (booking.PaymentStatus == PaymentCancelledStatus)
                return BadRequest("Vé này đã bị hủy trước đó.");

            if (booking.PaymentStatus == PaymentPaidStatus)
                return BadRequest("Vé đã thanh toán, không thể hủy tại đây. Vui lòng liên hệ nhà xe để được hỗ trợ.");

            if (booking.Trip != null)
                booking.Trip.AvailableSeats += booking.TotalSeats;

            booking.PaymentStatus = PaymentCancelledStatus;
            await _context.SaveChangesAsync();

            return Ok(new
            {
                booking.BookingID,
                booking.PaymentStatus,
                SeatsRestored = booking.TotalSeats
            });
        }

        [HttpPut("{id}/request-cancel")]
        [Authorize]
        public async Task<IActionResult> RequestCancel(int id, [FromBody] RequestCancelBookingRequest? request)
        {
            var currentUserId = GetCurrentUserId();
            if (!currentUserId.HasValue)
                return Unauthorized(new { message = "Token không hợp lệ" });

            var booking = await _context.Bookings
                .Include(x => x.Trip)
                .FirstOrDefaultAsync(x => x.BookingID == id);

            if (booking == null)
                return NotFound(new { message = "Không tìm thấy booking" });

            if (booking.UserID != currentUserId.Value)
                return Forbid();

            var now = DateTime.Now;
            if (booking.Trip != null && IsTripDepartedOrCompleted(booking.Trip, now))
                return BadRequest(new { message = "Chuyến xe đã chạy, không thể yêu cầu hủy vé" });

            var currentStatus = booking.BookingStatus ?? BookingPendingConfirmStatus;
            if (currentStatus == BookingCancelledStatus || booking.PaymentStatus == PaymentCancelledStatus || booking.PaymentStatus == PaymentRefundedStatus)
                return BadRequest(new { message = "Booking đã bị hủy, không thể yêu cầu hủy lại" });

            if (currentStatus == BookingCancelRequestedStatus)
                return BadRequest(new { message = "Booking đã gửi yêu cầu hủy trước đó" });

            if (currentStatus == BookingCancelRejectedStatus)
                return BadRequest(new { message = "Yeu cau huy ve da bi tu choi truoc do" });

            booking.BookingStatus = BookingCancelRequestedStatus;
            booking.CancelReason = NormalizeOptionalText(request?.CancelReason);

            await _context.SaveChangesAsync();

            var estimatedRefundAmount = string.Equals(booking.PaymentStatus, PaymentPaidStatus, StringComparison.OrdinalIgnoreCase)
                ? Math.Round(booking.TotalPrice * CalculateRefundRate(booking.Trip?.DepartureTime, now), 0)
                : 0m;

            return Ok(new
            {
                bookingID = booking.BookingID,
                bookingStatus = booking.BookingStatus,
                booking.CancelReason,
                estimatedRefundAmount,
                message = "Đã gửi yêu cầu hủy vé"
            });
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> Delete(int id)
        {
            var booking = await _context.Bookings.FindAsync(id);
            if (booking == null)
                return NotFound();

            var ticketSeats = await _context.TicketSeats
                .Where(t => t.BookingID == id)
                .ToListAsync();

            if (ticketSeats.Any())
                _context.TicketSeats.RemoveRange(ticketSeats);

            var trip = await _context.Trips.FindAsync(booking.TripID);
            if (trip != null)
                trip.AvailableSeats += booking.TotalSeats;

            _context.Bookings.Remove(booking);
            await _context.SaveChangesAsync();
            return Ok();
        }

        private int? GetCurrentUserId()
        {
            var claimValue = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return int.TryParse(claimValue, out var userId) ? userId : null;
        }

        private static bool IsOwnedByCurrent(int? holdUserId, string? holdSessionId, int? currentUserId, string? sessionId)
        {
            var isMineByUser = currentUserId.HasValue && holdUserId.HasValue && holdUserId.Value == currentUserId.Value;
            var isMineBySession = !string.IsNullOrWhiteSpace(sessionId) &&
                                  string.Equals(holdSessionId, sessionId, StringComparison.OrdinalIgnoreCase);

            return isMineByUser || isMineBySession;
        }

        private static List<string> NormalizeSeatLabels(List<string>? seatLabels)
        {
            return (seatLabels ?? new List<string>())
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Select(NormalizeSeatLabel)
                .Distinct()
                .ToList();
        }

        private static string NormalizeSeatLabel(string seatLabel)
        {
            return seatLabel.Trim().ToUpperInvariant();
        }

        private static string? NormalizeSessionId(string? sessionId)
        {
            return string.IsNullOrWhiteSpace(sessionId) ? null : sessionId.Trim();
        }

        private static bool IsTripDepartedOrCompleted(Trip trip, DateTime now)
        {
            return trip.DepartureTime <= now ||
                   string.Equals(trip.Status, "Completed", StringComparison.OrdinalIgnoreCase);
        }

        private static decimal CalculateRefundRate(DateTime? departureTime, DateTime now)
        {
            if (!departureTime.HasValue)
                return 0.5m;

            var hoursBeforeDeparture = (departureTime.Value - now).TotalHours;
            if (hoursBeforeDeparture > 24)
                return 0.9m;

            if (hoursBeforeDeparture >= 6)
                return 0.7m;

            if (hoursBeforeDeparture > 0)
                return 0.5m;

            return 0m;
        }

        private static string? NormalizeOptionalText(string? value)
        {
            return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
        }
    }

    public class CreateBookingRequest
    {
        public int TripId { get; set; }
        public string? SessionId { get; set; }
        public string? CustomerName { get; set; }
        public string? CustomerPhone { get; set; }
        public string? CustomerEmail { get; set; }
        public List<string>? SeatLabels { get; set; }
        public int? PickupStopId { get; set; }
        public int? DropoffStopId { get; set; }
        public string? PaymentMethod { get; set; }
        public string? PromotionCode { get; set; }
    }

    public class RequestCancelBookingRequest
    {
        public string? CancelReason { get; set; }
    }

    public class ApproveCancelBookingRequest
    {
        public decimal? RefundAmount { get; set; }
    }

    public class RejectCancelBookingRequest
    {
        public string? BookingStatus { get; set; }
        public string? RejectReason { get; set; }
    }

    public class TicketSeatInfoResponse
    {
        public int TicketSeatID { get; set; }
        public string? SeatLabel { get; set; }
        public string? QRCode { get; set; }
    }
}
