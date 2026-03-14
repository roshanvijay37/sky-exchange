using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SkyExchange.Data;

namespace SkyExchange.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class UserController(AppDbContext db) : ControllerBase
{
    private int UserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet("me")]
    public async Task<IActionResult> GetMe()
    {
        var user = await db.Users.FindAsync(UserId);
        return user is null ? NotFound() : Ok(new { user.Id, user.Username, user.Balance });
    }

    [HttpGet("me/positions")]
    public async Task<IActionResult> GetPositions()
    {
        var orders = await db.Orders
            .Where(o => o.UserId == UserId)
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
