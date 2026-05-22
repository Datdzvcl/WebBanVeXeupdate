using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using BaseCore.Entities;
using BaseCore.Repository;
using System.Security.Claims;

namespace BaseCore.APIService.Controllers
{
    [Route("api/reviews")]
    [ApiController]
    public class ReviewsController : ControllerBase
    {
        private readonly MySqlDbContext _context;

        public ReviewsController(MySqlDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetAll(int page = 1, int pageSize = 20, int? tripId = null, int? operatorId = null)
        {
            page = page <= 0 ? 1 : page;
            pageSize = pageSize <= 0 ? 20 : Math.Min(pageSize, 100);

            var query = _context.Reviews
                .AsNoTracking()
                .Include(x => x.User)
                .Include(x => x.Booking)
                .Include(x => x.Trip).ThenInclude(x => x.Bus).ThenInclude(x => x.Operator)
                .AsQueryable();

            if (tripId.HasValue)
                query = query.Where(x => x.TripID == tripId.Value);

            if (operatorId.HasValue)
                query = query.Where(x => x.Trip != null && x.Trip.Bus != null && x.Trip.Bus.OperatorID == operatorId.Value);

            var totalCount = await query.CountAsync();
            var items = await query
                .OrderByDescending(x => x.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(x => new
                {
                    x.ReviewID,
                    x.BookingID,
                    x.UserID,
                    x.TripID,
                    x.Rating,
                    x.Comment,
                    x.CreatedAt,
                    userName = x.User == null ? null : x.User.FullName,
                    customerName = x.Booking == null ? null : x.Booking.CustomerName,
                    operatorName = x.Trip == null || x.Trip.Bus == null || x.Trip.Bus.Operator == null
                        ? null
                        : x.Trip.Bus.Operator.Name,
                    route = x.Trip == null ? null : $"{x.Trip.DepartureLocation} - {x.Trip.ArrivalLocation}"
                })
                .ToListAsync();

            return Ok(new
            {
                items,
                totalCount,
                page,
                pageSize,
                totalPages = (int)Math.Ceiling(totalCount / (double)pageSize)
            });
        }

        [HttpGet("trip/{tripId:int}")]
        [AllowAnonymous]
        public async Task<IActionResult> GetByTrip(int tripId)
        {
            var reviews = await _context.Reviews
                .AsNoTracking()
                .Include(x => x.User)
                .Where(x => x.TripID == tripId)
                .OrderByDescending(x => x.CreatedAt)
                .Select(x => new
                {
                    x.ReviewID,
                    x.BookingID,
                    x.UserID,
                    x.TripID,
                    x.Rating,
                    x.Comment,
                    x.CreatedAt,
                    userName = x.User == null ? null : x.User.FullName
                })
                .ToListAsync();

            return Ok(new
            {
                items = reviews,
                averageRating = reviews.Count == 0 ? 0 : Math.Round(reviews.Average(x => x.Rating), 1),
                reviewCount = reviews.Count
            });
        }

        [HttpGet("operator/{operatorId:int}")]
        [AllowAnonymous]
        public async Task<IActionResult> GetByOperator(int operatorId)
        {
            var reviews = await _context.Reviews
                .AsNoTracking()
                .Include(x => x.User)
                .Include(x => x.Trip).ThenInclude(x => x.Bus)
                .Where(x => x.Trip != null && x.Trip.Bus != null && x.Trip.Bus.OperatorID == operatorId)
                .OrderByDescending(x => x.CreatedAt)
                .Select(x => new
                {
                    x.ReviewID,
                    x.BookingID,
                    x.UserID,
                    x.TripID,
                    x.Rating,
                    x.Comment,
                    x.CreatedAt,
                    userName = x.User == null ? null : x.User.FullName
                })
                .ToListAsync();

            return Ok(new
            {
                items = reviews,
                averageRating = reviews.Count == 0 ? 0 : Math.Round(reviews.Average(x => x.Rating), 1),
                reviewCount = reviews.Count
            });
        }

        [HttpGet("booking/{bookingId:int}")]
        [Authorize]
        public async Task<IActionResult> GetByBooking(int bookingId)
        {
            var review = await _context.Reviews
                .AsNoTracking()
                .Include(x => x.User)
                .Include(x => x.Booking)
                .FirstOrDefaultAsync(x => x.BookingID == bookingId);

            if (review == null)
                return NotFound(new { message = "Booking chua co danh gia" });

            if (!User.IsInRole("Admin"))
            {
                var currentUserId = GetCurrentUserId();
                if (!currentUserId.HasValue || review.UserID != currentUserId.Value)
                    return Forbid();
            }

            return Ok(ToReviewResponse(review));
        }

        [HttpPost]
        [Authorize]
        public async Task<IActionResult> Create([FromBody] ReviewRequest request)
        {
            var currentUserId = GetCurrentUserId();
            if (!currentUserId.HasValue)
                return Unauthorized(new { message = "Token khong hop le" });

            if (request.Rating < 1 || request.Rating > 5)
                return BadRequest(new { message = "Rating phai tu 1 den 5" });

            var booking = await _context.Bookings
                .Include(x => x.Trip).ThenInclude(x => x.Bus).ThenInclude(x => x.Operator)
                .FirstOrDefaultAsync(x => x.BookingID == request.BookingID);

            if (booking == null)
                return NotFound(new { message = "Khong tim thay booking" });

            if (booking.UserID != currentUserId.Value)
                return Forbid();

            if (await _context.Reviews.AnyAsync(x => x.BookingID == booking.BookingID))
                return Conflict(new { message = "Booking nay da duoc danh gia" });

            if (!CanReview(booking))
                return BadRequest(new { message = "Chi co the danh gia khi chuyen da hoan thanh hoac da qua gio den" });

            var review = new Review
            {
                BookingID = booking.BookingID,
                UserID = currentUserId.Value,
                TripID = booking.TripID,
                Rating = request.Rating,
                Comment = NormalizeComment(request.Comment),
                CreatedAt = DateTime.Now
            };

            _context.Reviews.Add(review);
            await _context.SaveChangesAsync();

            review.Booking = booking;
            review.User = await _context.Users.AsNoTracking().FirstOrDefaultAsync(x => x.UserID == currentUserId.Value);

            return Ok(ToReviewResponse(review));
        }

        [HttpPut("{id:int}")]
        [Authorize]
        public async Task<IActionResult> Update(int id, [FromBody] ReviewRequest request)
        {
            var review = await _context.Reviews.FirstOrDefaultAsync(x => x.ReviewID == id);
            if (review == null)
                return NotFound(new { message = "Khong tim thay danh gia" });

            if (!User.IsInRole("Admin"))
            {
                var currentUserId = GetCurrentUserId();
                if (!currentUserId.HasValue || review.UserID != currentUserId.Value)
                    return Forbid();
            }

            if (request.Rating < 1 || request.Rating > 5)
                return BadRequest(new { message = "Rating phai tu 1 den 5" });

            review.Rating = request.Rating;
            review.Comment = NormalizeComment(request.Comment);
            await _context.SaveChangesAsync();

            var updated = await _context.Reviews
                .AsNoTracking()
                .Include(x => x.User)
                .Include(x => x.Booking)
                .Include(x => x.Trip).ThenInclude(x => x.Bus).ThenInclude(x => x.Operator)
                .FirstAsync(x => x.ReviewID == id);

            return Ok(ToReviewResponse(updated));
        }

        [HttpDelete("{id:int}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> Delete(int id)
        {
            var review = await _context.Reviews.FindAsync(id);
            if (review == null)
                return NotFound(new { message = "Khong tim thay danh gia" });

            _context.Reviews.Remove(review);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Da xoa danh gia" });
        }

        private int? GetCurrentUserId()
        {
            var claimValue = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return int.TryParse(claimValue, out var userId) ? userId : null;
        }

        private static bool CanReview(Booking booking)
        {
            if (booking.Trip == null)
                return false;

            var bookingStatus = booking.BookingStatus ?? "PendingConfirm";
            if (string.Equals(bookingStatus, "Cancelled", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(bookingStatus, "CancelRequested", StringComparison.OrdinalIgnoreCase))
                return false;

            return string.Equals(booking.Trip.Status, "Completed", StringComparison.OrdinalIgnoreCase) ||
                   booking.Trip.ArrivalTime <= DateTime.Now;
        }

        private static string? NormalizeComment(string? comment)
        {
            var value = string.IsNullOrWhiteSpace(comment) ? null : comment.Trim();
            return value == null || value.Length <= 500 ? value : value[..500];
        }

        private static object ToReviewResponse(Review review)
        {
            return new
            {
                review.ReviewID,
                review.BookingID,
                review.UserID,
                review.TripID,
                review.Rating,
                review.Comment,
                review.CreatedAt,
                userName = review.User == null ? null : review.User.FullName,
                customerName = review.Booking == null ? null : review.Booking.CustomerName,
                operatorName = review.Trip == null || review.Trip.Bus == null || review.Trip.Bus.Operator == null
                    ? null
                    : review.Trip.Bus.Operator.Name,
                route = review.Trip == null ? null : $"{review.Trip.DepartureLocation} - {review.Trip.ArrivalLocation}"
            };
        }
    }

    public class ReviewRequest
    {
        public int BookingID { get; set; }
        public byte Rating { get; set; }
        public string? Comment { get; set; }
    }
}
