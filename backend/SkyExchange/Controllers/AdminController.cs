using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SkyExchange.Data;
using SkyExchange.Models;
using System.Security.Cryptography;

namespace SkyExchange.Controllers;

public record SettleRequest(string WinningOutcome);
public record AdjustBalanceRequest(decimal Amount, string Reason);
public record CreateUserRequest(string Username, string Password, decimal Balance);

[ApiController]
[Route("api/admin")]
[Authorize(Roles = "admin")]
public class AdminController(AppDbContext db) : ControllerBase
{
    private const decimal CommissionRate = 0.05m; // 5% on winner's profit

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
        var totalCommission = 0m;

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
                var commission = Math.Round(profit * CommissionRate, 2);
                var netProfit = profit - commission;
                totalCommission += commission;

                if (isWinningOutcome)
                {
                    trade.BackOrder.User.Balance += trade.Stake + netProfit;
                    payouts.Add(new { User = trade.BackOrder.User.Username, Amount = trade.Stake + netProfit, Commission = commission, Result = "won (back)" });
                }
                else
                {
                    trade.LayOrder.User.Balance += trade.Stake + netProfit;
                    payouts.Add(new { User = trade.LayOrder.User.Username, Amount = trade.Stake + netProfit, Commission = commission, Result = "won (lay)" });
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

        return Ok(new { Message = $"Match settled. Winner: {req.WinningOutcome}. Commission earned: ${totalCommission:F2} ({CommissionRate * 100}%)", Payouts = payouts, TotalCommission = totalCommission });
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

    [HttpPost("users/create")]
    public async Task<IActionResult> CreateUser([FromBody] CreateUserRequest req)
    {
        if (req.Username.Length < 3 || req.Password.Length < 4)
            return BadRequest("Username min 3 chars, password min 4 chars");
        if (await db.Users.AnyAsync(u => u.Username == req.Username))
            return BadRequest("Username already taken");

        var salt = RandomNumberGenerator.GetBytes(16);
        var hash = Rfc2898DeriveBytes.Pbkdf2(req.Password, salt, 100000, HashAlgorithmName.SHA256, 32);
        var passwordHash = $"{Convert.ToBase64String(salt)}.{Convert.ToBase64String(hash)}";

        var user = new User
        {
            Username = req.Username,
            PasswordHash = passwordHash,
            Balance = req.Balance > 0 ? req.Balance : 10000m,
            CreatedAt = DateTime.UtcNow
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();
        return Ok(new { user.Id, user.Username, user.Balance });
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

    [HttpGet("matches")]
    public async Task<IActionResult> GetAllMatches()
    {
        var matches = await db.Matches
            .OrderBy(m => m.StartTime)
            .Select(m => new
            {
                m.Id,
                Sport = m.SportTitle != "" ? m.SportTitle : m.Sport,
                m.TeamA, m.TeamB, m.StartTime, m.Status, m.IsVisible
            })
            .ToListAsync();
        return Ok(matches);
    }

    [HttpPost("matches/{matchId}/toggle-visibility")]
    public async Task<IActionResult> ToggleVisibility(int matchId)
    {
        var match = await db.Matches.FindAsync(matchId);
        if (match is null) return NotFound("Match not found");
        match.IsVisible = !match.IsVisible;
        await db.SaveChangesAsync();
        return Ok(new { matchId, match.IsVisible });
    }

    [HttpPost("matches/{matchId}/suspend")]
    public async Task<IActionResult> ToggleMarketSuspension(int matchId)
    {
        var markets = await db.Markets.Where(m => m.MatchId == matchId && m.Status != "closed").ToListAsync();
        if (markets.Count == 0) return NotFound("No open markets for this match");

        var newStatus = markets[0].Status == "open" ? "suspended" : "open";
        foreach (var m in markets) m.Status = newStatus;
        await db.SaveChangesAsync();

        return Ok(new { matchId, MarketStatus = newStatus });
    }

    [HttpGet("dashboard")]
    public async Task<IActionResult> GetDashboard()
    {
        var today = DateTime.UtcNow.Date;

        var totalUsers = await db.Users.CountAsync();
        var activeUsers = await db.Orders
            .Where(o => o.CreatedAt >= today.AddDays(-7))
            .Select(o => o.UserId).Distinct().CountAsync();

        var totalOrders = await db.Orders.CountAsync();
        var todayOrders = await db.Orders.CountAsync(o => o.CreatedAt >= today);
        var pendingOrders = await db.Orders.CountAsync(o => o.Status == "pending");

        var totalTrades = await db.Trades.CountAsync();
        var todayTrades = await db.Trades.CountAsync(t => t.CreatedAt >= today);
        var totalVolume = await db.Trades.SumAsync(t => t.Stake);
        var todayVolume = await db.Trades.Where(t => t.CreatedAt >= today).SumAsync(t => t.Stake);

        var totalBalances = await db.Users.SumAsync(u => u.Balance);
        var initialBalance = await db.Users.CountAsync() * 10000m;
        var platformPnl = initialBalance - totalBalances;

        // Commission earned from settled trades
        var settledMatchIds = await db.Matches.Where(m => m.Status == "completed").Select(m => m.Id).ToListAsync();
        var settledTrades = await db.Trades
            .Where(t => settledMatchIds.Contains(t.Odd.Market.MatchId))
            .SumAsync(t => t.Stake * (t.Price - 1));
        var totalCommission = Math.Round(settledTrades * CommissionRate, 2);

        var matchStats = await db.Matches
            .Where(m => m.Status != "completed")
            .Select(m => new
            {
                m.Id,
                Match = m.TeamA + " vs " + m.TeamB,
                m.Status,
                Orders = db.Orders.Count(o => o.Odd.Market.MatchId == m.Id && o.Status == "pending"),
                Trades = db.Trades.Count(t => t.Odd.Market.MatchId == m.Id),
                Volume = db.Trades.Where(t => t.Odd.Market.MatchId == m.Id).Sum(t => t.Stake)
            })
            .OrderByDescending(m => m.Orders)
            .ToListAsync();

        var topTraders = await db.Users
            .Where(u => !u.IsAdmin)
            .Select(u => new
            {
                u.Username,
                u.Balance,
                Trades = db.Trades.Count(t => t.BackOrder.UserId == u.Id || t.LayOrder.UserId == u.Id),
                Volume = db.Trades
                    .Where(t => t.BackOrder.UserId == u.Id || t.LayOrder.UserId == u.Id)
                    .Sum(t => t.Stake)
            })
            .Where(u => u.Trades > 0)
            .OrderByDescending(u => u.Volume)
            .Take(10)
            .ToListAsync();

        return Ok(new
        {
            TotalUsers = totalUsers,
            ActiveUsers = activeUsers,
            TotalOrders = totalOrders,
            TodayOrders = todayOrders,
            PendingOrders = pendingOrders,
            TotalTrades = totalTrades,
            TodayTrades = todayTrades,
            TotalVolume = totalVolume,
            TodayVolume = todayVolume,
            TotalBalances = totalBalances,
            PlatformPnl = platformPnl,
            TotalCommission = totalCommission,
            CommissionRate = CommissionRate * 100,
            MatchStats = matchStats,
            TopTraders = topTraders
        });
    }
}
