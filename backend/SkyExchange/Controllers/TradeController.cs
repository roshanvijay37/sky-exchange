using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using SkyExchange.Data;
using SkyExchange.Hubs;
using SkyExchange.Models;

namespace SkyExchange.Controllers;

public record TradeRequest(int UserId, int OddsId, string Side, decimal Price, decimal Stake);

[ApiController]
[Route("api/[controller]")]
public class TradeController(AppDbContext db, IHubContext<OddsHub> hub) : ControllerBase
{
    // POST /api/trade — place a new back or lay order
    [HttpPost]
    public async Task<IActionResult> PlaceOrder([FromBody] TradeRequest req)
    {
        if (req.Side is not ("back" or "lay"))
            return BadRequest("Side must be 'back' or 'lay'");

        var user = await db.Users.FindAsync(req.UserId);
        if (user is null) return NotFound("User not found");

        var liability = req.Side == "back" ? req.Stake : req.Stake * (req.Price - 1);
        if (user.Balance < liability)
            return BadRequest("Insufficient balance");

        user.Balance -= liability;

        var order = new Order
        {
            UserId = req.UserId,
            OddsId = req.OddsId,
            Side = req.Side,
            Price = req.Price,
            Stake = req.Stake,
            Status = "pending",
            CreatedAt = DateTime.UtcNow
        };
        db.Orders.Add(order);
        await db.SaveChangesAsync();

        await TryMatch(order);

        // Shift odds based on trade pressure and broadcast
        await ShiftAndBroadcast(req.OddsId, req.Side);

        return Ok(new { order.Id, order.Status, user.Balance });
    }

    // DELETE /api/trade/1?userId=1 — cancel a pending order
    [HttpDelete("{orderId}")]
    public async Task<IActionResult> CancelOrder(int orderId, [FromQuery] int userId)
    {
        var order = await db.Orders.FindAsync(orderId);
        if (order is null) return NotFound("Order not found");
        if (order.UserId != userId) return BadRequest("Not your order");
        if (order.Status != "pending") return BadRequest("Only pending orders can be cancelled");

        var user = await db.Users.FindAsync(userId);
        if (user is null) return NotFound("User not found");

        // Refund liability
        var refund = order.Side == "back" ? order.Stake : order.Stake * (order.Price - 1);
        user.Balance += refund;
        order.Status = "cancelled";
        await db.SaveChangesAsync();

        return Ok(new { order.Id, order.Status, user.Balance });
    }

    private async Task ShiftAndBroadcast(int oddsId, string side)
    {
        var odd = await db.Odds.Include(o => o.Market).FirstOrDefaultAsync(o => o.Id == oddsId);
        if (odd is null) return;

        // Back pressure pushes price down, lay pressure pushes price up
        var shift = side == "back" ? -0.02m : 0.02m;
        odd.BackPrice = Math.Max(1.01m, odd.BackPrice + shift);
        odd.LayPrice = odd.BackPrice + 0.05m;
        odd.LastUpdated = DateTime.UtcNow;
        await db.SaveChangesAsync();

        // Broadcast the updated odds to clients watching this match
        await hub.Clients.Group($"match-{odd.Market.MatchId}")
            .SendAsync("OddsUpdated", new
            {
                MarketId = odd.MarketId,
                Odds = new[] { new { odd.Id, odd.Outcome, odd.BackPrice, odd.LayPrice } }
            });
    }

    private async Task TryMatch(Order incoming)
    {
        var oppositeSide = incoming.Side == "back" ? "lay" : "back";

        var candidates = await db.Orders
            .Where(o => o.OddsId == incoming.OddsId
                     && o.Side == oppositeSide
                     && o.Status == "pending"
                     && o.Id != incoming.Id)
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
