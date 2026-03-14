using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SkyExchange.Data;
using SkyExchange.Models;

namespace SkyExchange.Controllers;

public record TradeRequest(int OddsId, string Side, decimal Price, decimal Stake);

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TradeController(AppDbContext db) : ControllerBase
{
    private int UserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    private const decimal MinStake = 1m;
    private const decimal MaxStake = 5000m;
    private const decimal MinPrice = 1.01m;
    private const decimal MaxPrice = 1000m;

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

        var user = await db.Users.FindAsync(UserId);
        if (user is null) return NotFound("User not found");

        var liability = req.Side == "back" ? req.Stake : req.Stake * (req.Price - 1);
        if (liability <= 0) return BadRequest("Invalid liability");
        if (user.Balance < liability)
            return BadRequest("Insufficient balance");

        user.Balance -= liability;
        if (user.Balance < 0) return BadRequest("Insufficient balance");

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
        await db.SaveChangesAsync();

        await TryMatch(order);

        return Ok(new { order.Id, order.Status, user.Balance });
    }

    [HttpDelete("{orderId}")]
    public async Task<IActionResult> CancelOrder(int orderId)
    {
        var order = await db.Orders.FindAsync(orderId);
        if (order is null) return NotFound("Order not found");
        if (order.UserId != UserId) return BadRequest("Not your order");
        if (order.Status != "pending") return BadRequest("Only pending orders can be cancelled");

        var user = await db.Users.FindAsync(UserId);
        if (user is null) return NotFound("User not found");

        var refund = order.Side == "back" ? order.Stake : order.Stake * (order.Price - 1);
        user.Balance += refund;
        order.Status = "cancelled";
        await db.SaveChangesAsync();

        return Ok(new { order.Id, order.Status, user.Balance });
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
