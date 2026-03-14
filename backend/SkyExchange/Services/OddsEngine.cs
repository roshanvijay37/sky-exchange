using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using SkyExchange.Data;
using SkyExchange.Hubs;

namespace SkyExchange.Services;

public class OddsEngine(IServiceProvider services, IHubContext<OddsHub> hub, ILogger<OddsEngine> logger) : BackgroundService
{
    private static readonly Random Rng = new();

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Wait a bit for the app to fully start
        await Task.Delay(5000, stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await UpdateOdds(stoppingToken);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "OddsEngine tick failed, retrying...");
            }
            await Task.Delay(3000, stoppingToken);
        }
    }

    private async Task UpdateOdds(CancellationToken ct)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var liveOdds = await db.Odds
            .Include(o => o.Market)
            .Where(o => o.Market.Status == "open"
                     && db.Matches.Any(m => m.Id == o.Market.MatchId && m.Status == "live"))
            .ToListAsync(ct);

        if (liveOdds.Count == 0) return;

        var byMarket = liveOdds.GroupBy(o => o.Market);

        foreach (var group in byMarket)
        {
            var updates = new List<object>();

            foreach (var odd in group)
            {
                var drift = Math.Round((decimal)(Rng.NextDouble() * 0.06 - 0.03), 2);
                odd.BackPrice = Math.Max(1.01m, odd.BackPrice + drift);
                odd.LayPrice = odd.BackPrice + 0.05m;
                odd.LastUpdated = DateTime.UtcNow;

                updates.Add(new
                {
                    odd.Id,
                    odd.Outcome,
                    odd.BackPrice,
                    odd.LayPrice
                });
            }

            await db.SaveChangesAsync(ct);

            var matchId = group.Key.MatchId;
            await hub.Clients.Group($"match-{matchId}")
                .SendAsync("OddsUpdated", new { MarketId = group.Key.Id, Odds = updates }, ct);
        }
    }
}
