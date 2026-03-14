using System.Security.Claims;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using SkyExchange.Data;
using SkyExchange.Hubs;
using SkyExchange.Models;

namespace SkyExchange.Controllers;

public record TradeRequest(int OddsId, string Side, decimal Price, decimal Stake);

[ApiController]
[Route("api/[controller]")]
[Authorize]
[EnableRateLimiting("trade")]
public class TradeController(AppDbContext db, IHubContext<OddsHub> hub) : ControllerBase
{
    private int UserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    private const decimal MinStake = 1m;
    private const decimal MaxStake = 5000m;
    private const decimal MinPrice = 1.01m;
    private const decimal MaxPrice = 1000m;
    private const int MaxRetries = 3;

    [HttpPost]
    public async Task<IActionResult> PlaceOrder([FromBody] TradeRequest req)
    {
        if (req.Side is not ("back" or "lay"))
            return BadRequest("Side must be 'back' or 'lay'");
        if (req.Stake < MinStake || req.Stake > MaxStake)
            return BadRequest($"Stake must be between {MinStake} and {MaxStake}");
        if (req.Price < MinPrice || req.Price > MaxPrice)
            return BadRequest($"Price must be between {MinPrice} and {MaxPrice}");
        if (Math.Round(req.Price, 2) != req.Price)
            return BadRequest("Price must have at most 2 decimal places");

        var odd = await db.Odds.Include(o => o.Market).FirstOrDefaultAsync(o => o.Id == req.OddsId);
        if (odd is null) return NotFound("Odds not found");
        if (odd.Market.Status != "open") return BadRequest("Market is closed");

        for (int attempt = 0; attempt < MaxRetries; attempt++)
        {
            var user = await db.Users.FindAsync(UserId);
            if (user is null) return NotFound("User not found");

            var liability = req.Side == "back" ? req.Stake : req.Stake * (req.Price - 1);
            if (liability <= 0) return BadRequest("Invalid liability");
            if (user.Balance < liability)
                return BadRequest("Insufficient balance");

            user.Balance -= liability;
            user.Version++;

            var order = new Order
            {
                UserId = UserId,
                OddsId = req.OddsId,
                Side = req.Side,
                Price = req.Price,
                Stake = req.Stake,
                Status = "pending",
                CreatedAt = DateTime.UtcNow
            };
            db.Orders.Add(order);

            try
            {
                await db.SaveChangesAsync();
                await TryMatch(order);
                await BroadcastOrderBook(req.OddsId, odd.Market.MatchId);
                return Ok(new { order.Id, order.Status, user.Balance });
            }
            catch (DbUpdateConcurrencyException)
            {
                db.ChangeTracker.Clear();
                if (attempt == MaxRetries - 1)
                    return Conflict("Too many concurrent requests, please retry");
            }
        }

        return Conflict("Please retry");
    }

    [HttpDelete("{orderId}")]
    public async Task<IActionResult> CancelOrder(int orderId)
    {
        var order = await db.Orders.Include(o => o.Odd).ThenInclude(o => o.Market).FirstOrDefaultAsync(o => o.Id == orderId);
        if (order is null) return NotFound("Order not found");
        if (order.UserId != UserId) return BadRequest("Not your order");
        if (order.Status != "pending") return BadRequest("Only pending orders can be cancelled");

        for (int attempt = 0; attempt < MaxRetries; attempt++)
        {
            var user = await db.Users.FindAsync(UserId);
            if (user is null) return NotFound("User not found");

            var refund = order.Side == "back" ? order.Stake : order.Stake * (order.Price - 1);
            user.Balance += refund;
            user.Version++;
            order.Status = "cancelled";

            try
            {
                await db.SaveChangesAsync();
                await BroadcastOrderBook(order.OddsId, order.Odd.Market.MatchId);
                return Ok(new { order.Id, order.Status, user.Balance });
            }
            catch (DbUpdateConcurrencyException)
            {
                db.ChangeTracker.Clear();
                order = await db.Orders.Include(o => o.Odd).ThenInclude(o => o.Market).FirstOrDefaultAsync(o => o.Id == orderId);
                if (order is null || order.Status != "pending")
                    return BadRequest("Order already processed");
                if (attempt == MaxRetries - 1)
                    return Conflict("Too many concurrent requests, please retry");
            }
        }

        return Conflict("Please retry");
    }

    private async Task BroadcastOrderBook(int oddsId, int matchId)
    {
        var orders = await db.Orders
            .Where(o => o.OddsId == oddsId && o.Status == "pending")
            .GroupBy(o => new { o.Side, o.Price })
            .Select(g => new { g.Key.Side, g.Key.Price, TotalStake = g.Sum(o => o.Stake), Count = g.Count() })
            .OrderBy(o => o.Price)
            .ToListAsync();

        await hub.Clients.Group($"match-{matchId}")
            .SendAsync("OrderBookUpdated", new
            {
                OddsId = oddsId,
                Backs = orders.Where(o => o.Side == "back"),
                Lays = orders.Where(o => o.Side == "lay")
            });
    }

    private async Task TryMatch(Order incoming)
    {
        var oppositeSide = incoming.Side == "back" ? "lay" : "back";

        var candidates = await db.Orders
            .Where(o => o.OddsId == incoming.OddsId
                     && o.Side == oppositeSide
                     && o.Status == "pending"
                     && o.Id != incoming.Id
                     && o.UserId != incoming.UserId)
            .Where(o => incoming.Side == "back"
                ? o.Price <= incoming.Price
                : o.Price >= incoming.Price)
            .OrderBy(o => incoming.Side == "back" ? o.Price : 0)
            .ThenByDescending(o => incoming.Side == "lay" ? o.Price : 0)
            .ToListAsync();

        foreach (var match in candidates)
        {
            if (incoming.Status != "pending") break;

            var tradeStake = Math.Min(incoming.Stake, match.Stake);
            var tradePrice = match.Price;

            var backOrder = incoming.Side == "back" ? incoming : match;
            var layOrder = incoming.Side == "lay" ? incoming : match;

            db.Trades.Add(new Trade
            {
                BackOrderId = backOrder.Id,
                LayOrderId = layOrder.Id,
                OddsId = incoming.OddsId,
                Price = tradePrice,
                Stake = tradeStake,
                CreatedAt = DateTime.UtcNow
            });

            incoming.Stake -= tradeStake;
            match.Stake -= tradeStake;

            if (incoming.Stake == 0) incoming.Status = "matched";
            if (match.Stake == 0) match.Status = "matched";
        }

        await db.SaveChangesAsync();
    }
}
