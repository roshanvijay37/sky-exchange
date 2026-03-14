using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SkyExchange.Data;

namespace SkyExchange.Controllers;

public record SettleRequest(string WinningOutcome);
public record AdjustBalanceRequest(decimal Amount, string Reason);

[ApiController]
[Route("api/admin")]
[Authorize(Roles = "admin")]
public class AdminController(AppDbContext db) : ControllerBase
{
    // POST /api/admin/settle/3 — settle a match with the winning outcome
    [HttpPost("settle/{matchId}")]
    public async Task<IActionResult> SettleMatch(int matchId, [FromBody] SettleRequest req)
    {
        var match = await db.Matches.FindAsync(matchId);
        if (match is null) return NotFound("Match not found");
        if (match.Status == "completed") return BadRequest("Match already settled");

        // Get all markets for this match
        var markets = await db.Markets
            .Where(m => m.MatchId == matchId)
            .Include(m => m.Odds)
            .ToListAsync();

        var payouts = new List<object>();

        foreach (var market in markets)
        {
            // Get all matched trades in this market
            var trades = await db.Trades
                .Where(t => market.Odds.Select(o => o.Id).Contains(t.OddsId))
                .Include(t => t.BackOrder).ThenInclude(o => o.User)
                .Include(t => t.LayOrder).ThenInclude(o => o.User)
                .Include(t => t.Odd)
                .ToListAsync();

            foreach (var trade in trades)
            {
                var isWinningOutcome = trade.Odd.Outcome == req.WinningOutcome;
                var profit = trade.Stake * (trade.Price - 1);

                if (isWinningOutcome)
                {
                    // Back wins: gets stake + profit
                    trade.BackOrder.User.Balance += trade.Stake + profit;
                    payouts.Add(new { User = trade.BackOrder.User.Username, Amount = trade.Stake + profit, Result = "won (back)" });
                }
                else
                {
                    // Lay wins: gets the stake (their liability is already deducted)
                    trade.LayOrder.User.Balance += trade.Stake + profit;
                    payouts.Add(new { User = trade.LayOrder.User.Username, Amount = trade.Stake + profit, Result = "won (lay)" });
                }
            }

            // Cancel all remaining pending orders and refund
            var pendingOrders = await db.Orders
                .Where(o => market.Odds.Select(od => od.Id).Contains(o.OddsId) && o.Status == "pending")
                .Include(o => o.User)
                .ToListAsync();

            foreach (var order in pendingOrders)
            {
                var refund = order.Side == "back" ? order.Stake : order.Stake * (order.Price - 1);
                order.User.Balance += refund;
                order.Status = "cancelled";
            }

            market.Status = "closed";
        }

        match.Status = "completed";
        match.WinningOutcome = req.WinningOutcome;
        await db.SaveChangesAsync();

        return Ok(new { Message = $"Match settled. Winner: {req.WinningOutcome}", Payouts = payouts });
    }

    [HttpGet("users")]
    public async Task<IActionResult> GetUsers()
    {
        var users = await db.Users
            .Select(u => new
            {
                u.Id, u.Username, u.Balance, u.IsAdmin, u.IsSuspended, u.CreatedAt,
                OrderCount = db.Orders.Count(o => o.UserId == u.Id),
                TradeCount = db.Trades.Count(t => t.BackOrder.UserId == u.Id || t.LayOrder.UserId == u.Id)
            })
            .OrderBy(u => u.Id)
            .ToListAsync();
        return Ok(users);
    }

    [HttpPost("users/{userId}/adjust")]
    public async Task<IActionResult> AdjustBalance(int userId, [FromBody] AdjustBalanceRequest req)
    {
        var user = await db.Users.FindAsync(userId);
        if (user is null) return NotFound("User not found");
        user.Balance += req.Amount;
        if (user.Balance < 0) user.Balance = 0;
        await db.SaveChangesAsync();
        return Ok(new { user.Id, user.Balance, req.Reason });
    }

    [HttpPost("users/{userId}/suspend")]
    public async Task<IActionResult> ToggleSuspend(int userId)
    {
        var user = await db.Users.FindAsync(userId);
        if (user is null) return NotFound("User not found");
        if (user.IsAdmin) return BadRequest("Cannot suspend admin");
        user.IsSuspended = !user.IsSuspended;
        await db.SaveChangesAsync();
        return Ok(new { user.Id, user.IsSuspended });
    }
}
