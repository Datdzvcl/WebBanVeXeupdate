using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using BaseCore.Entities;
using BaseCore.Repository;
using System.Security.Claims;

namespace BaseCore.APIService.Controllers
{
    [Route("api/payments")]
    [ApiController]
    public class PaymentsController : ControllerBase
    {
        private const string BookingConfirmedStatus = "Confirmed";
        private const string PaymentPaidStatus = "Paid";
        private const string PaymentPendingStatus = "Pending";

        private readonly MySqlDbContext _context;

        public PaymentsController(MySqlDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetAll(
            string? paymentStatus,
            int? bookingId,
            DateTime? fromDate,
            DateTime? toDate,
            int page = 1,
            int pageSize = 20)
        {
            page = page <= 0 ? 1 : page;
            pageSize = pageSize <= 0 ? 20 : Math.Min(pageSize, 100);

            var query = _context.Payments
                .AsNoTracking()
                .Include(x => x.Booking).ThenInclude(x => x.Trip)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(paymentStatus))
            {
                var status = paymentStatus.Trim();
                query = query.Where(x => x.PaymentStatus == status);
            }

            if (bookingId.HasValue)
                query = query.Where(x => x.BookingID == bookingId.Value);

            if (fromDate.HasValue)
                query = query.Where(x => x.CreatedAt >= fromDate.Value.Date);

            if (toDate.HasValue)
                query = query.Where(x => x.CreatedAt < toDate.Value.Date.AddDays(1));

            var totalCount = await query.CountAsync();
            var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);

            var items = await query
                .OrderByDescending(x => x.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(x => new
                {
                    x.PaymentID,
                    x.BookingID,
                    x.Amount,
                    x.PaymentMethod,
                    x.PaymentStatus,
                    x.TransactionCode,
                    x.PaidAt,
                    x.CreatedAt,
                    customerName = x.Booking == null ? null : x.Booking.CustomerName,
                    customerPhone = x.Booking == null ? null : x.Booking.CustomerPhone,
                    bookingStatus = x.Booking == null ? null : x.Booking.BookingStatus,
                    bookingPaymentStatus = x.Booking == null ? null : x.Booking.PaymentStatus,
                    route = x.Booking == null || x.Booking.Trip == null
                        ? null
                        : $"{x.Booking.Trip.DepartureLocation} - {x.Booking.Trip.ArrivalLocation}",
                    departureTime = x.Booking == null || x.Booking.Trip == null
                        ? (DateTime?)null
                        : x.Booking.Trip.DepartureTime
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

        [HttpGet("booking/{bookingId:int}")]
        [Authorize]
        public async Task<IActionResult> GetByBooking(int bookingId)
        {
            var booking = await _context.Bookings
                .AsNoTracking()
                .Include(x => x.Payments)
                .FirstOrDefaultAsync(x => x.BookingID == bookingId);

            if (booking == null)
                return NotFound(new { message = "Khong tim thay booking" });

            if (!User.IsInRole("Admin"))
            {
                var currentUserId = GetCurrentUserId();
                if (!currentUserId.HasValue || booking.UserID != currentUserId.Value)
                    return Forbid();
            }

            var payments = (booking.Payments ?? new List<Payment>())
                .OrderByDescending(x => x.CreatedAt)
                .Select(x => new
                {
                    x.PaymentID,
                    x.BookingID,
                    x.Amount,
                    x.PaymentMethod,
                    x.PaymentStatus,
                    x.TransactionCode,
                    x.PaidAt,
                    x.CreatedAt
                })
                .ToList();

            return Ok(payments);
        }

        [HttpPost("simulate")]
        [Authorize]
        public async Task<IActionResult> Simulate([FromBody] SimulatePaymentRequest request)
        {
            var booking = await _context.Bookings.FindAsync(request.BookingID);
            if (booking == null)
                return NotFound(new { message = "Khong tim thay booking" });

            if (!User.IsInRole("Admin"))
            {
                var currentUserId = GetCurrentUserId();
                if (!currentUserId.HasValue || booking.UserID != currentUserId.Value)
                    return Forbid();
            }

            if (string.Equals(booking.PaymentStatus, PaymentPaidStatus, StringComparison.OrdinalIgnoreCase))
                return BadRequest(new { message = "Booking da duoc thanh toan" });

            var now = DateTime.Now;
            var method = NormalizePaymentMethod(request.PaymentMethod ?? booking.PaymentMethod);
            var status = IsPendingMethod(method) ? PaymentPendingStatus : PaymentPaidStatus;
            var amount = request.Amount.HasValue && request.Amount.Value > 0
                ? request.Amount.Value
                : booking.TotalPrice;

            var payment = new Payment
            {
                BookingID = booking.BookingID,
                Amount = amount,
                PaymentMethod = method,
                PaymentStatus = status,
                TransactionCode = NormalizeOptionalText(request.TransactionCode) ?? CreateTransactionCode(booking.BookingID),
                PaidAt = status == PaymentPaidStatus ? now : null,
                CreatedAt = now
            };

            booking.PaymentMethod = method;
            booking.PaymentStatus = status;

            _context.Payments.Add(payment);
            NotificationsController.AddNotification(
                _context,
                booking.UserID,
                status == PaymentPaidStatus ? "Thanh toán thành công" : "Đã ghi nhận phương thức thanh toán",
                status == PaymentPaidStatus
                    ? $"Đơn #{booking.BookingID} đã thanh toán thành công và đang chờ admin xác nhận."
                    : $"Đơn #{booking.BookingID} đang chờ thanh toán/xác nhận.",
                status == PaymentPaidStatus ? (byte)1 : (byte)3);
            await _context.SaveChangesAsync();

            return Ok(ToResponse(payment, booking));
        }

        [HttpPut("{id:int}/confirm")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> Confirm(int id, [FromBody] ConfirmPaymentRequest? request)
        {
            var payment = await _context.Payments
                .Include(x => x.Booking)
                .FirstOrDefaultAsync(x => x.PaymentID == id);

            if (payment == null)
                return NotFound(new { message = "Khong tim thay giao dich" });

            var now = DateTime.Now;
            payment.PaymentStatus = PaymentPaidStatus;
            payment.PaidAt = now;
            payment.TransactionCode = NormalizeOptionalText(request?.TransactionCode) ?? payment.TransactionCode ?? CreateTransactionCode(payment.BookingID);

            if (payment.Booking != null)
            {
                payment.Booking.PaymentMethod = payment.PaymentMethod;
                payment.Booking.PaymentStatus = PaymentPaidStatus;
                payment.Booking.BookingStatus = BookingConfirmedStatus;
                NotificationsController.AddNotification(
                    _context,
                    payment.Booking.UserID,
                    "Thanh toán đã được xác nhận",
                    $"Admin đã xác nhận thanh toán cho đơn #{payment.BookingID}.",
                    1);
            }

            await _context.SaveChangesAsync();

            return Ok(ToResponse(payment, payment.Booking));
        }

        internal static string NormalizePaymentMethod(string? method)
        {
            var value = NormalizeOptionalText(method);
            if (value == null)
                return "BankTransfer";

            var lowered = value.ToLowerInvariant();
            if (lowered == "cash" || lowered == "tienmat" || lowered.Contains("tien mat"))
                return "Cash";

            if (lowered == "banktransfer" || lowered == "chuyenkhoan" || lowered.Contains("chuyen khoan"))
                return "BankTransfer";

            if (lowered == "ewallet" || lowered == "vnpay" || lowered.Contains("vi dien tu"))
                return "EWallet";

            return value.Length > 30 ? value[..30] : value;
        }

        internal static bool IsPendingMethod(string method)
        {
            return string.Equals(method, "Cash", StringComparison.OrdinalIgnoreCase);
        }

        internal static string CreateTransactionCode(int bookingId)
        {
            return $"VEXEAZ-{bookingId}-{DateTime.Now:yyyyMMddHHmmss}";
        }

        private int? GetCurrentUserId()
        {
            var claimValue = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return int.TryParse(claimValue, out var userId) ? userId : null;
        }

        private static string? NormalizeOptionalText(string? value)
        {
            return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
        }

        private static object ToResponse(Payment payment, Booking? booking)
        {
            return new
            {
                payment.PaymentID,
                payment.BookingID,
                payment.Amount,
                payment.PaymentMethod,
                payment.PaymentStatus,
                payment.TransactionCode,
                payment.PaidAt,
                payment.CreatedAt,
                bookingStatus = booking?.BookingStatus,
                bookingPaymentStatus = booking?.PaymentStatus
            };
        }
    }

    public class SimulatePaymentRequest
    {
        public int BookingID { get; set; }
        public decimal? Amount { get; set; }
        public string? PaymentMethod { get; set; }
        public string? TransactionCode { get; set; }
    }

    public class ConfirmPaymentRequest
    {
        public string? TransactionCode { get; set; }
    }
}
