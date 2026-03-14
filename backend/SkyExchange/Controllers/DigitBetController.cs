using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using SkyExchange.Data;
using SkyExchange.Models;

namespace SkyExchange.Controllers;

public record DigitBetRequest(int MatchId, string Team, int Digit, decimal Stake);

[ApiController]
[Route("api/digit-bet")]
[Authorize]
[EnableRateLimiting("trade")]
public class DigitBetController(AppDbContext db) : ControllerBase
{
    private const decimal MaxStake = 500m;
    private const decimal Multiplier = 7m;
    private int UserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpPost]
    public async Task<IActionResult> Place([FromBody] DigitBetRequest req)
    {
        if (req.Stake < 100 || req.Stake > MaxStake || req.Stake % 100 != 0)
            return BadRequest("Stake must be ₹100 to ₹500 in multiples of ₹100");
        if (req.Digit < 0 || req.Digit > 9)
            return BadRequest("Digit must be 0-9");
        if (req.Team is not ("A" or "B"))
            return BadRequest("Team must be 'A' or 'B'");

        var match = await db.Matches.FindAsync(req.MatchId);
        if (match is null) return NotFound("Match not found");
        if (match.Status == "completed" || match.Status == "voided")
            return BadRequest("Match is over");
        if (match.IsLocked) return BadRequest("Match is locked");

        var user = await db.Users.FindAsync(UserId);
        if (user is null) return NotFound();
        if (user.Balance < req.Stake) return BadRequest("Insufficient balance");

        user.Balance -= req.Stake;
        user.Version++;

        var bet = new DigitBet
        {
            UserId = UserId,
            MatchId = req.MatchId,
            Team = req.Team,
            Digit = req.Digit,
            Stake = req.Stake,
            Status = "pending",
            CreatedAt = DateTime.UtcNow
        };
        db.DigitBets.Add(bet);
        await db.SaveChangesAsync();

        return Ok(new { bet.Id, bet.Status, user.Balance });
    }

    [HttpGet("match/{matchId}")]
    public async Task<IActionResult> GetMyBets(int matchId)
    {
        var bets = await db.DigitBets
            .Where(d => d.MatchId == matchId && d.UserId == UserId)
            .OrderByDescending(d => d.CreatedAt)
            .Select(d => new { d.Id, d.Team, d.Digit, d.Stake, d.Status, d.Payout, d.CreatedAt })
            .ToListAsync();
        return Ok(bets);
    }
}
