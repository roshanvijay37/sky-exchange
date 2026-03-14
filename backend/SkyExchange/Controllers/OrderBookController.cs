using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SkyExchange.Data;

namespace SkyExchange.Controllers;

[ApiController]
[Route("api/[controller]")]
public class OrderBookController(AppDbContext db) : ControllerBase
{
    // GET /api/orderbook/1 — returns aggregated pending orders for an outcome
    [HttpGet("{oddsId}")]
    public async Task<IActionResult> Get(int oddsId)
    {
        var orders = await db.Orders
            .Where(o => o.OddsId == oddsId && o.Status == "pending")
            .GroupBy(o => new { o.Side, o.Price })
            .Select(g => new
            {
                g.Key.Side,
                g.Key.Price,
                TotalStake = g.Sum(o => o.Stake),
                Count = g.Count()
            })
            .OrderBy(o => o.Price)
            .ToListAsync();

        return Ok(new
        {
            Backs = orders.Where(o => o.Side == "back"),
            Lays = orders.Where(o => o.Side == "lay")
        });
    }
}
