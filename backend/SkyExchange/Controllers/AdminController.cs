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
            .Where(u => u.Username != "__house__")
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
                m.Id, m.TeamA, m.TeamB, m.StartTime, m.Status, m.IsVisible, m.IsLocked
            })
            .ToListAsync();
        return Ok(matches);
    }

    public record SettleDigitsRequest(int ScoreA, int ScoreB);

    [HttpPost("matches/{matchId}/settle-digits")]
    public async Task<IActionResult> SettleDigits(int matchId, [FromBody] SettleDigitsRequest req)
    {
        var match = await db.Matches.FindAsync(matchId);
        if (match is null) return NotFound("Match not found");

        var lastDigitA = req.ScoreA % 10;
        var lastDigitB = req.ScoreB % 10;

        var bets = await db.DigitBets
            .Where(d => d.MatchId == matchId && d.Status == "pending")
            .Include(d => d.User)
            .ToListAsync();

        var winners = 0;
        var totalPayout = 0m;
        var totalCommission = 0m;

        foreach (var bet in bets)
        {
            var winningDigit = bet.Team == "A" ? lastDigitA : lastDigitB;
            if (bet.Digit == winningDigit)
            {
                var gross = bet.Stake * 7m;
                var commission = Math.Round(gross * CommissionRate, 2);
                bet.Status = "won";
                bet.Payout = gross - commission;
                bet.User.Balance += bet.Payout;
                winners++;
                totalPayout += bet.Payout;
                totalCommission += commission;
            }
            else
            {
                bet.Status = "lost";
            }
        }

        await db.SaveChangesAsync();
        return Ok(new { Message = $"Score: {req.ScoreA}-{req.ScoreB} (digits: {lastDigitA},{lastDigitB}). {winners}/{bets.Count} won. Payout: ₹{totalPayout}" });
    }

    [HttpPost("matches/{matchId}/toggle-lock")]
    public async Task<IActionResult> ToggleLock(int matchId)
    {
        var match = await db.Matches.FindAsync(matchId);
        if (match is null) return NotFound("Match not found");
        match.IsLocked = !match.IsLocked;
        await db.SaveChangesAsync();
        return Ok(new { matchId, match.IsLocked });
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

    public record SetOddsRequest(string Outcome, decimal Price);
    public record UnlockOddsRequest(string Outcome);

    [HttpPost("matches/{matchId}/set-odds")]
    public async Task<IActionResult> SetOdds(int matchId, [FromBody] SetOddsRequest req)
    {
        if (req.Price < 1.10m)
            return BadRequest("Price must be >= 1.10");

        var odd = await db.Odds
            .Include(o => o.Market)
            .FirstOrDefaultAsync(o => o.Market.MatchId == matchId && o.Outcome == req.Outcome);
        if (odd is null) return NotFound("Outcome not found for this match");

        odd.BackPrice = Math.Round(req.Price - 0.05m, 2);
        odd.LayPrice = Math.Round(req.Price + 0.05m, 2);
        odd.IsLocked = true;
        odd.LastUpdated = DateTime.UtcNow;
        await db.SaveChangesAsync();

        return Ok(new { matchId, req.Outcome, odd.BackPrice, odd.LayPrice, odd.IsLocked });
    }

    [HttpPost("matches/{matchId}/unlock-odds")]
    public async Task<IActionResult> UnlockOdds(int matchId, [FromBody] UnlockOddsRequest req)
    {
        var odd = await db.Odds
            .Include(o => o.Market)
            .FirstOrDefaultAsync(o => o.Market.MatchId == matchId && o.Outcome == req.Outcome);
        if (odd is null) return NotFound("Outcome not found");
        odd.IsLocked = false;
        await db.SaveChangesAsync();
        return Ok(new { matchId, req.Outcome, odd.IsLocked });
    }

    [HttpPost("matches/{matchId}/void")]
    public async Task<IActionResult> VoidMatch(int matchId)
    {
        var match = await db.Matches.FindAsync(matchId);
        if (match is null) return NotFound("Match not found");
        if (match.Status == "completed") return BadRequest("Cannot void a settled match");

        var markets = await db.Markets
            .Where(m => m.MatchId == matchId)
            .Include(m => m.Odds)
            .ToListAsync();

        var oddIds = markets.SelectMany(m => m.Odds).Select(o => o.Id).ToList();
        var refundCount = 0;

        // Refund all matched trades
        var trades = await db.Trades
            .Where(t => oddIds.Contains(t.OddsId))
            .Include(t => t.BackOrder).ThenInclude(o => o.User)
            .Include(t => t.LayOrder).ThenInclude(o => o.User)
            .ToListAsync();

        foreach (var trade in trades)
        {
            trade.BackOrder.User.Balance += trade.Stake;
            trade.LayOrder.User.Balance += trade.Stake * (trade.Price - 1);
            trade.BackOrder.Status = "voided";
            trade.LayOrder.Status = "voided";
            refundCount++;
        }

        // Refund all pending orders
        var pendingOrders = await db.Orders
            .Where(o => oddIds.Contains(o.OddsId) && o.Status == "pending")
            .Include(o => o.User)
            .ToListAsync();

        foreach (var order in pendingOrders)
        {
            var refund = order.Side == "back" ? order.Stake : order.Stake * (order.Price - 1);
            order.User.Balance += refund;
            order.Status = "voided";
        }

        match.Status = "voided";
        foreach (var m in markets) m.Status = "closed";
        await db.SaveChangesAsync();

        return Ok(new { Message = $"Match voided. {refundCount} trade(s) refunded, {pendingOrders.Count} pending order(s) refunded." });
    }

    [HttpGet("exposure")]
    public async Task<IActionResult> GetExposure()
    {
        var house = await db.Users.FirstOrDefaultAsync(u => u.Username == "__house__");
        if (house is null) return Ok(Array.Empty<object>());

        var activeMatches = await db.Matches
            .Where(m => m.Status != "completed")
            .Include(m => m.Markets).ThenInclude(m => m.Odds)
            .ToListAsync();

        var result = new List<object>();

        foreach (var match in activeMatches)
        {
            var oddIds = match.Markets.SelectMany(m => m.Odds).Select(o => o.Id).ToList();
            var trades = await db.Trades
                .Where(t => oddIds.Contains(t.OddsId))
                .Include(t => t.Odd)
                .Include(t => t.BackOrder)
                .Include(t => t.LayOrder)
                .ToListAsync();

            if (trades.Count == 0) continue;

            var outcomes = match.Markets.SelectMany(m => m.Odds).Select(o => o.Outcome).Distinct();
            var outcomeExposures = new List<object>();

            foreach (var outcome in outcomes)
            {
                var housePnl = 0m;
                foreach (var trade in trades)
                {
                    var profit = trade.Stake * (trade.Price - 1);
                    var isThisOutcome = trade.Odd.Outcome == outcome;

                    if (trade.BackOrder.UserId == house.Id)
                    {
                        housePnl += isThisOutcome ? profit : -trade.Stake;
                    }
                    else if (trade.LayOrder.UserId == house.Id)
                    {
                        housePnl += isThisOutcome ? -profit : trade.Stake;
                    }
                }
                outcomeExposures.Add(new { Outcome = outcome, HousePnl = Math.Round(housePnl, 2) });
            }

            var totalVolume = trades.Sum(t => t.Stake);
            result.Add(new
            {
                MatchId = match.Id,
                Match = $"{match.TeamA} vs {match.TeamB}",
                match.Status,
                TotalVolume = totalVolume,
                Outcomes = outcomeExposures
            });
        }

        return Ok(result);
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
        var house = await db.Users.FirstOrDefaultAsync(u => u.Username == "__house__");
        var housePnl = house != null ? house.Balance - 999_999_999m : 0m;

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
            PlatformPnl = housePnl,
            TotalCommission = totalCommission,
            CommissionRate = CommissionRate * 100,
            MatchStats = matchStats,
            TopTraders = topTraders
        });
    }
}
