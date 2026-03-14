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

    [HttpGet("me/trades")]
    public async Task<IActionResult> GetTrades()
    {
        var trades = await db.Trades
            .Where(t => t.BackOrder.UserId == UserId || t.LayOrder.UserId == UserId)
            .Include(t => t.Odd).ThenInclude(o => o.Market).ThenInclude(m => m.Match)
            .Include(t => t.BackOrder)
            .Include(t => t.LayOrder)
            .OrderByDescending(t => t.CreatedAt)
            .Select(t => new
            {
                t.Id,
                Match = t.Odd.Market.Match.TeamA + " vs " + t.Odd.Market.Match.TeamB,
                MatchStatus = t.Odd.Market.Match.Status,
                WinningOutcome = t.Odd.Market.Match.WinningOutcome,
                Outcome = t.Odd.Outcome,
                Side = t.BackOrder.UserId == UserId ? "back" : "lay",
                t.Price,
                t.Stake,
                t.CreatedAt
            })
            .ToListAsync();

        var result = trades.Select(t =>
        {
            var profit = t.Stake * (t.Price - 1);
            string pnlStatus;
            decimal pnl;

            if (t.MatchStatus != "completed" || t.WinningOutcome == null)
            {
                pnlStatus = "open";
                pnl = 0;
            }
            else
            {
                var backWon = t.Outcome == t.WinningOutcome;
                var userWon = (t.Side == "back" && backWon) || (t.Side == "lay" && !backWon);
                pnlStatus = userWon ? "won" : "lost";
                pnl = userWon ? profit : -profit;
            }

            return new
            {
                t.Id, t.Match, t.Outcome, t.Side, t.Price, t.Stake,
                Pnl = pnl, PnlStatus = pnlStatus, t.CreatedAt
            };
        });

        return Ok(result);
    }
}
