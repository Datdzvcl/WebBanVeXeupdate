using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using BaseCore.Entities;
using BaseCore.Repository;
using System.Security.Claims;

namespace BaseCore.APIService.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class BusImagesController : ControllerBase
    {
        private readonly MySqlDbContext _context;

        public BusImagesController(MySqlDbContext context)
        {
            _context = context;
        }

        private async Task<int?> GetCurrentOperatorId()
        {
            var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!int.TryParse(userIdClaim, out var userId)) return null;
            var user = await _context.Users.AsNoTracking()
                .FirstOrDefaultAsync(x => x.UserID == userId);
            return user?.OperatorID;
        }

        // GET api/busimages/bus/5  - public: lấy ảnh của xe (dùng cho trang tìm kiếm/chi tiết chuyến)
        [HttpGet("bus/{busId:int}")]
        [AllowAnonymous]
        public async Task<IActionResult> GetByBus(int busId)
        {
            var images = await _context.BusImages
                .AsNoTracking()
                .Where(x => x.BusID == busId)
                .OrderByDescending(x => x.IsAvatar)
                .ThenBy(x => x.SortOrder)
                .Select(x => new
                {
                    x.ImageID,
                    x.BusID,
                    x.ImageURL,
                    x.IsAvatar,
                    x.SortOrder,
                    x.UploadedAt
                })
                .ToListAsync();

            return Ok(images);
        }

        // POST api/busimages  - operator: thêm ảnh cho xe của mình
        [HttpPost]
        [Authorize(Roles = "Operator")]
        public async Task<IActionResult> Create([FromBody] BusImage image)
        {
            var operatorId = await GetCurrentOperatorId();
            if (!operatorId.HasValue)
                return BadRequest(new { message = "Tài khoản chưa liên kết với nhà xe" });

            // Kiểm tra xe có thuộc nhà xe này không
            var bus = await _context.Buses.AsNoTracking()
                .FirstOrDefaultAsync(x => x.BusID == image.BusID);
            if (bus == null) return NotFound(new { message = "Xe không tồn tại" });
            if (bus.OperatorID != operatorId.Value) return Forbid();

            // Nếu đặt làm avatar, xóa avatar cũ
            if (image.IsAvatar)
            {
                var oldAvatar = await _context.BusImages
                    .FirstOrDefaultAsync(x => x.BusID == image.BusID && x.IsAvatar);
                if (oldAvatar != null)
                    oldAvatar.IsAvatar = false;
            }

            image.UploadedAt = DateTime.Now;
            _context.BusImages.Add(image);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                image.ImageID,
                image.BusID,
                image.ImageURL,
                image.IsAvatar,
                image.SortOrder,
                image.UploadedAt
            });
        }

        // PUT api/busimages/5  - operator: cập nhật thông tin ảnh
        [HttpPut("{id:int}")]
        [Authorize(Roles = "Operator")]
        public async Task<IActionResult> Update(int id, [FromBody] BusImage image)
        {
            if (id != image.ImageID)
                return BadRequest("ID không khớp");

            var operatorId = await GetCurrentOperatorId();
            if (!operatorId.HasValue)
                return BadRequest(new { message = "Tài khoản chưa liên kết với nhà xe" });

            var existing = await _context.BusImages
                .Include(x => x.Bus)
                .FirstOrDefaultAsync(x => x.ImageID == id);
            if (existing == null) return NotFound();
            if (existing.Bus?.OperatorID != operatorId.Value) return Forbid();

            // Nếu đặt làm avatar, xóa avatar cũ
            if (image.IsAvatar && !existing.IsAvatar)
            {
                var oldAvatar = await _context.BusImages
                    .FirstOrDefaultAsync(x => x.BusID == existing.BusID && x.IsAvatar && x.ImageID != id);
                if (oldAvatar != null)
                    oldAvatar.IsAvatar = false;
            }

            existing.ImageURL = image.ImageURL;
            existing.IsAvatar = image.IsAvatar;
            existing.SortOrder = image.SortOrder;
            await _context.SaveChangesAsync();

            return Ok(existing);
        }

        // PATCH api/busimages/5/avatar  - operator: đặt làm ảnh đại diện
        [HttpPatch("{id:int}/avatar")]
        [Authorize(Roles = "Operator")]
        public async Task<IActionResult> SetAvatar(int id)
        {
            var operatorId = await GetCurrentOperatorId();
            if (!operatorId.HasValue)
                return BadRequest(new { message = "Tài khoản chưa liên kết với nhà xe" });

            var image = await _context.BusImages
                .Include(x => x.Bus)
                .FirstOrDefaultAsync(x => x.ImageID == id);
            if (image == null) return NotFound();
            if (image.Bus?.OperatorID != operatorId.Value) return Forbid();

            // Xóa avatar cũ
            var oldAvatar = await _context.BusImages
                .FirstOrDefaultAsync(x => x.BusID == image.BusID && x.IsAvatar && x.ImageID != id);
            if (oldAvatar != null)
                oldAvatar.IsAvatar = false;

            image.IsAvatar = true;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Đã đặt làm ảnh đại diện" });
        }

        // DELETE api/busimages/5  - operator: xóa ảnh
        [HttpDelete("{id:int}")]
        [Authorize(Roles = "Operator")]
        public async Task<IActionResult> Delete(int id)
        {
            var operatorId = await GetCurrentOperatorId();
            if (!operatorId.HasValue)
                return BadRequest(new { message = "Tài khoản chưa liên kết với nhà xe" });

            var image = await _context.BusImages
                .Include(x => x.Bus)
                .FirstOrDefaultAsync(x => x.ImageID == id);
            if (image == null) return NotFound();
            if (image.Bus?.OperatorID != operatorId.Value) return Forbid();

            _context.BusImages.Remove(image);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Đã xóa ảnh" });
        }
    }
}
