using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SkyExchange.Data;

namespace SkyExchange.Controllers;

[ApiController]
[Route("api/[controller]")]
public class UserController(AppDbContext db) : ControllerBase
{
    // GET /api/user/1 — returns user info
    [HttpGet("{userId}")]
    public async Task<IActionResult> GetUser(int userId)
    {
        var user = await db.Users.FindAsync(userId);
        return user is null ? NotFound() : Ok(new { user.Id, user.Username, user.Balance });
    }

    // GET /api/user/1/positions — returns user's orders and matched trades
    [HttpGet("{userId}/positions")]
    public async Task<IActionResult> GetPositions(int userId)
    {
        var orders = await db.Orders
            .Where(o => o.UserId == userId)
            .Include(o => o.Odd)
            .Select(o => new
            {
                o.Id,
                o.Side,
                o.Price,
                o.Stake,
                o.Status,
                Outcome = o.Odd.Outcome,
                o.CreatedAt
            })
            .OrderByDescending(o => o.CreatedAt)
            .ToListAsync();

        return Ok(orders);
    }
}
