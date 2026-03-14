using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SkyExchange.Data;

namespace SkyExchange.Controllers;

[ApiController]
[Route("api/[controller]")]
public class MarketsController(AppDbContext db) : ControllerBase
{
    // GET /api/markets/match/1 — returns all markets + odds for a match
    [HttpGet("match/{matchId}")]
    public async Task<IActionResult> GetByMatch(int matchId)
    {
        var markets = await db.Markets
            .Where(m => m.MatchId == matchId)
            .Select(m => new
            {
                m.Id,
                m.Name,
                m.Status,
                Odds = m.Odds.Select(o => new
                {
                    o.Id,
                    o.Outcome,
                    o.BackPrice,
                    o.LayPrice
                })
            })
            .ToListAsync();

        return Ok(markets);
    }
}
