// using Microsoft.AspNetCore.Authorization;
// using Microsoft.AspNetCore.Mvc;
// using Microsoft.EntityFrameworkCore;
// using BaseCore.Entities;
// using BaseCore.Repository;

// namespace BaseCore.APIService.Controllers
// {
//     [Route("api/[controller]")]
//     [ApiController]
//     [Authorize(Roles = "Admin")]
//     public class OperatorsController : ControllerBase
//     {
//         private readonly MySqlDbContext _context;

//         public OperatorsController(MySqlDbContext context)
//         {
//             _context = context;
//         }

//         [HttpGet]
//         public async Task<IActionResult> GetAll(
//             [FromQuery] string? name,
//             [FromQuery] string? phone,
//             [FromQuery] string? email,
//             [FromQuery] int page = 1,
//             [FromQuery] int pageSize = 10)
//         {
//             page = Math.Max(page, 1);
//             pageSize = Math.Clamp(pageSize, 1, 100);

//             var query = _context.Operators.AsNoTracking().AsQueryable();

//             if (!string.IsNullOrWhiteSpace(name))
//             {
//                 var keyword = name.Trim();
//                 query = query.Where(x => EF.Functions.Like(x.Name, $"%{keyword}%"));
//             }

//             if (!string.IsNullOrWhiteSpace(phone))
//             {
//                 var keyword = phone.Trim();
//                 query = query.Where(x => EF.Functions.Like(x.ContactPhone, $"%{keyword}%"));
//             }

//             if (!string.IsNullOrWhiteSpace(email))
//             {
//                 var keyword = email.Trim();
//                 query = query.Where(x => x.Email != null && EF.Functions.Like(x.Email, $"%{keyword}%"));
//             }

//             var totalCount = await query.CountAsync();
//             var items = await query
//                 .OrderBy(x => x.OperatorID)
//                 .Skip((page - 1) * pageSize)
//                 .Take(pageSize)
//                 .ToListAsync();

//             return Ok(new
//             {
//                 items,
//                 totalCount,
//                 page,
//                 pageSize,
//                 totalPages = (int)Math.Ceiling((double)totalCount / pageSize)
//             });
//         }

//         [HttpGet("{id:int}")]
//         public async Task<IActionResult> GetById(int id)
//         {
//             var item = await _context.Operators
//                 .AsNoTracking()
//                 .FirstOrDefaultAsync(x => x.OperatorID == id);

//             if (item == null)
//                 return NotFound();

//             return Ok(item);
//         }

//         [HttpPost]
//         public async Task<IActionResult> Create([FromBody] Operator item)
//         {
//             _context.Operators.Add(item);
//             await _context.SaveChangesAsync();

//             return Ok(item);
//         }

//         [HttpPut("{id:int}")]
//         public async Task<IActionResult> Update(int id, [FromBody] Operator item)
//         {
//             if (id != item.OperatorID)
//                 return BadRequest("ID không khớp");

//             _context.Entry(item).State = EntityState.Modified;
//             await _context.SaveChangesAsync();

//             return Ok(item);
//         }

//         [HttpDelete("{id:int}")]
//         public async Task<IActionResult> Delete(int id)
//         {
//             var item = await _context.Operators.FindAsync(id);

//             if (item == null)
//                 return NotFound();

//             _context.Operators.Remove(item);
//             await _context.SaveChangesAsync();

//             return Ok();
//         }
//     }
// }


using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using BaseCore.Entities;
using BaseCore.Repository;
using System.Security.Claims;
using BaseCore.Common;

namespace BaseCore.APIService.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class OperatorsController : ControllerBase
    {
        private readonly MySqlDbContext _context;

        public OperatorsController(MySqlDbContext context)
        {
            _context = context;
        }

        // Lấy OperatorID của user đang login
        private async Task<int?> GetCurrentOperatorId()
        {
            var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!int.TryParse(userIdClaim, out var userId)) return null;

            var user = await _context.Users.AsNoTracking()
                .FirstOrDefaultAsync(x => x.UserID == userId);
            return user?.OperatorID;
        }

        // ==================== ADMIN APIs ====================

        [HttpGet]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetAll(
            [FromQuery] string? name,
            [FromQuery] string? phone,
            [FromQuery] string? email,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 10)
        {
            page = Math.Max(page, 1);
            pageSize = Math.Clamp(pageSize, 1, 100);

            var query = _context.Operators.AsNoTracking().AsQueryable();

            if (!string.IsNullOrWhiteSpace(name))
                query = query.Where(x => EF.Functions.Like(x.Name, $"%{name.Trim()}%"));

            if (!string.IsNullOrWhiteSpace(phone))
                query = query.Where(x => EF.Functions.Like(x.ContactPhone, $"%{phone.Trim()}%"));

            if (!string.IsNullOrWhiteSpace(email))
                query = query.Where(x => x.Email != null && EF.Functions.Like(x.Email, $"%{email.Trim()}%"));

            var totalCount = await query.CountAsync();
            var items = await query
                .OrderBy(x => x.OperatorID)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return Ok(new { items, totalCount, page, pageSize,
                totalPages = (int)Math.Ceiling((double)totalCount / pageSize) });
        }

        [HttpGet("{id:int}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetById(int id)
        {
            var item = await _context.Operators.AsNoTracking()
                .FirstOrDefaultAsync(x => x.OperatorID == id);
            return item == null ? NotFound() : Ok(item);
        }

        [HttpPost]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> Create([FromBody] Operator item)
        {
            _context.Operators.Add(item);
            await _context.SaveChangesAsync();
            return Ok(item);
        }

        [HttpPut("{id:int}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> Update(int id, [FromBody] Operator item)
        {
            if (id != item.OperatorID)
                return BadRequest("ID không khớp");
            _context.Entry(item).State = EntityState.Modified;
            await _context.SaveChangesAsync();
            return Ok(item);
        }

        [HttpDelete("{id:int}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> Delete(int id)
        {
            var item = await _context.Operators.FindAsync(id);
            if (item == null) return NotFound();
            _context.Operators.Remove(item);
            await _context.SaveChangesAsync();
            return Ok();
        }

        // ==================== OPERATOR APIs ====================

        // Nhà xe xem thông tin của mình
        [HttpGet("me")]
        [Authorize(Roles = "Operator")]
        public async Task<IActionResult> GetMe()
        {
            var operatorId = await GetCurrentOperatorId();
            if (operatorId == null)
                return BadRequest(new { message = "Tài khoản chưa liên kết với nhà xe" });

            var item = await _context.Operators.AsNoTracking()
                .FirstOrDefaultAsync(x => x.OperatorID == operatorId);
            return item == null ? NotFound() : Ok(item);
        }

        // Nhà xe cập nhật thông tin của mình
        [HttpPut("me")]
        [Authorize(Roles = "Operator")]
        public async Task<IActionResult> UpdateMe([FromBody] OperatorUpdateRequest request)
        {
            var operatorId = await GetCurrentOperatorId();
            if (operatorId == null)
                return BadRequest(new { message = "Tài khoản chưa liên kết với nhà xe" });

            var item = await _context.Operators.FindAsync(operatorId);
            if (item == null) return NotFound();

            item.Name = request.Name ?? item.Name;
            item.Description = request.Description ?? item.Description;
            item.ContactPhone = request.ContactPhone ?? item.ContactPhone;
            item.Email = request.Email ?? item.Email;

            await _context.SaveChangesAsync();
            return Ok(item);
        }

        // Nhà xe xem chuyến xe của mình
        [HttpGet("me/trips")]
        [Authorize(Roles = "Operator")]
        public async Task<IActionResult> GetMyTrips(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 10)
        {
            var operatorId = await GetCurrentOperatorId();
            if (operatorId == null)
                return BadRequest(new { message = "Tài khoản chưa liên kết với nhà xe" });

            page = Math.Max(page, 1);
            pageSize = Math.Clamp(pageSize, 1, 100);

            var query = _context.Trips
                .AsNoTracking()
                .Include(x => x.Bus)
                .Where(x => x.Bus.OperatorID == operatorId);

            var totalCount = await query.CountAsync();
            var items = await query
                .OrderByDescending(x => x.DepartureTime)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(x => new
                {
                    x.TripID, x.DepartureLocation, x.ArrivalLocation,
                    x.DepartureTime, x.ArrivalTime, x.Price,
                    x.AvailableSeats, x.Status,
                    BusType = x.Bus.BusType,
                    LicensePlate = x.Bus.LicensePlate
                })
                .ToListAsync();

            return Ok(new { items, totalCount, page, pageSize,
                totalPages = (int)Math.Ceiling((double)totalCount / pageSize) });
        }

        // Nhà xe xem đơn đặt vé của mình
        [HttpGet("me/bookings")]
        [Authorize(Roles = "Operator")]
        public async Task<IActionResult> GetMyBookings(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 10,
            [FromQuery] byte? status = null)
        {
            var operatorId = await GetCurrentOperatorId();
            if (operatorId == null)
                return BadRequest(new { message = "Tài khoản chưa liên kết với nhà xe" });

            page = Math.Max(page, 1);
            pageSize = Math.Clamp(pageSize, 1, 100);

            var query = _context.Bookings
                .AsNoTracking()
                .Include(x => x.Trip).ThenInclude(x => x.Bus)
                .Where(x => x.Trip.Bus.OperatorID == operatorId);

            if (status.HasValue)
                query = query.Where(x => x.BookingStatus == status.Value);

            var totalCount = await query.CountAsync();
            var items = await query
                .OrderByDescending(x => x.BookingDate)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(x => new
                {
                    x.BookingID, x.CustomerName, x.CustomerPhone,
                    x.TotalSeats, x.TotalPrice, x.BookingStatus, x.BookingDate,
                    TripRoute = $"{x.Trip.DepartureLocation} - {x.Trip.ArrivalLocation}",
                    DepartureTime = x.Trip.DepartureTime
                })
                .ToListAsync();

            return Ok(new { items, totalCount, page, pageSize,
                totalPages = (int)Math.Ceiling((double)totalCount / pageSize) });
        }

        // Nhà xe xem đánh giá của mình
        [HttpGet("me/reviews")]
        [Authorize(Roles = "Operator")]
        public async Task<IActionResult> GetMyReviews(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 10)
        {
            var operatorId = await GetCurrentOperatorId();
            if (operatorId == null)
                return BadRequest(new { message = "Tài khoản chưa liên kết với nhà xe" });

            page = Math.Max(page, 1);
            pageSize = Math.Clamp(pageSize, 1, 100);

            var query = _context.Reviews
                .AsNoTracking()
                .Include(x => x.Booking).ThenInclude(x => x.Trip).ThenInclude(x => x.Bus)
                .Include(x => x.User)
                .Where(x => x.Booking.Trip.Bus.OperatorID == operatorId);

            var totalCount = await query.CountAsync();
            var items = await query
                .OrderByDescending(x => x.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(x => new
                {
                    x.ReviewID, x.Rating, x.Comment, x.CreatedAt,
                    UserName = x.User.FullName,
                    TripRoute = $"{x.Booking.Trip.DepartureLocation} - {x.Booking.Trip.ArrivalLocation}"
                })
                .ToListAsync();

            return Ok(new { items, totalCount, page, pageSize,
                totalPages = (int)Math.Ceiling((double)totalCount / pageSize),
                averageRating = totalCount == 0 ? 0 :
                    Math.Round(await query.AverageAsync(x => (double)x.Rating), 1) });
        }
    }

    public class OperatorUpdateRequest
    {
        public string? Name { get; set; }
        public string? Description { get; set; }
        public string? ContactPhone { get; set; }
        public string? Email { get; set; }
    }
}