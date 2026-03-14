using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SkyExchange.Data;

namespace SkyExchange.Controllers;

[ApiController]
[Route("api/[controller]")]
public class MatchesController(AppDbContext db) : ControllerBase
{
    // GET /api/matches — returns all matches
    // GET /api/matches?status=live — returns only live matches
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? status)
    {
        var query = db.Matches.AsQueryable();
        if (!string.IsNullOrEmpty(status))
            query = query.Where(m => m.Status == status);

        var matches = await query
            .OrderBy(m => m.StartTime)
            .Select(m => new
            {
                m.Id,
                Sport = m.SportTitle != "" ? m.SportTitle : m.Sport,
                m.TeamA,
                m.TeamB,
                m.StartTime,
                m.Status
            })
            .ToListAsync();

        return Ok(matches);
    }

    // GET /api/matches/1 — returns a single match by ID
    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var match = await db.Matches
            .Where(m => m.Id == id)
            .Select(m => new
            {
                m.Id,
                Sport = m.SportTitle != "" ? m.SportTitle : m.Sport,
                m.TeamA,
                m.TeamB,
                m.StartTime,
                m.Status
            })
            .FirstOrDefaultAsync();

        return match is null ? NotFound() : Ok(match);
    }
}
