using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using SkyExchange.Data;
using SkyExchange.Models;

namespace SkyExchange.Controllers;

public record EnterContestRequest(int PredictedScoreA, int PredictedScoreB);
public record CreateContestRequest(int MatchId);
public record SettleContestRequest(int ActualScoreA, int ActualScoreB);

[ApiController]
[Route("api/contest")]
[Authorize]
[EnableRateLimiting("trade")]
public class ContestController(AppDbContext db) : ControllerBase
{
    private const decimal EntryFee = 100m;
    private const int MaxPlayers = 10;
    private const decimal Prize1st = 500m;
    private const decimal Prize2nd = 300m;

    private int UserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet("match/{matchId}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetContests(int matchId)
    {
        var contests = await db.ScoreContests
            .Where(c => c.MatchId == matchId)
            .Include(c => c.Predictions).ThenInclude(p => p.User)
            .Include(c => c.Match)
            .OrderByDescending(c => c.CreatedAt)
            .ToListAsync();

        return Ok(contests.Select(c => new
        {
            c.Id,
            c.MatchId,
            TeamA = c.Match.TeamA,
            TeamB = c.Match.TeamB,
            c.EntryFee,
            c.MaxPlayers,
            c.Status,
            Filled = c.Predictions.Count,
            c.ActualScoreA,
            c.ActualScoreB,
            Predictions = c.Predictions
                .OrderBy(p => p.Rank ?? 999).ThenBy(p => p.CreatedAt)
                .Select(p => new
                {
                    p.Id,
                    Username = p.User.Username,
                    p.PredictedScoreA,
                    p.PredictedScoreB,
                    p.Difference,
                    p.Rank,
                    p.Payout
                })
        }));
    }

    [HttpPost("{contestId}/enter")]
    public async Task<IActionResult> Enter(int contestId, [FromBody] EnterContestRequest req)
    {
        if (req.PredictedScoreA < 0 || req.PredictedScoreB < 0)
            return BadRequest("Scores must be positive");

        var contest = await db.ScoreContests
            .Include(c => c.Predictions)
            .FirstOrDefaultAsync(c => c.Id == contestId);
        if (contest is null) return NotFound("Contest not found");
        if (contest.Status != "open") return BadRequest("Contest is not open");
        if (contest.Predictions.Count >= MaxPlayers) return BadRequest("Contest is full");
        if (contest.Predictions.Any(p => p.UserId == UserId)) return BadRequest("You already entered this contest");

        var user = await db.Users.FindAsync(UserId);
        if (user is null) return NotFound();
        if (user.Balance < EntryFee) return BadRequest("Insufficient balance");

        user.Balance -= EntryFee;
        user.Version++;

        var prediction = new ScorePrediction
        {
            ContestId = contestId,
            UserId = UserId,
            PredictedScoreA = req.PredictedScoreA,
            PredictedScoreB = req.PredictedScoreB,
            CreatedAt = DateTime.UtcNow
        };
        db.ScorePredictions.Add(prediction);

        // Auto-close if full
        if (contest.Predictions.Count + 1 >= MaxPlayers)
            contest.Status = "full";

        await db.SaveChangesAsync();

        return Ok(new
        {
            prediction.Id,
            user.Balance,
            Filled = contest.Predictions.Count + 1,
            contest.Status
        });
    }
}
