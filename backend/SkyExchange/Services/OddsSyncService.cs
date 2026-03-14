using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using SkyExchange.Data;
using SkyExchange.Models;

namespace SkyExchange.Services;

public class OddsSyncService(IServiceProvider services, IConfiguration config, ILogger<OddsSyncService> logger) : BackgroundService
{
    private static readonly string[] SportKeys = ["cricket_ipl", "cricket_international_t20", "cricket_odi"];

    private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNameCaseInsensitive = true };

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await Task.Delay(3000, stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await SyncOdds(stoppingToken);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "OddsSync failed, retrying...");
            }
            // Sync every 30 minutes to conserve API quota (500 requests/month)
            await Task.Delay(TimeSpan.FromMinutes(30), stoppingToken);
        }
    }

    private async Task SyncOdds(CancellationToken ct)
    {
        var apiKey = Environment.GetEnvironmentVariable("ODDS_API_KEY") ?? config["OddsApi:Key"];
        if (string.IsNullOrEmpty(apiKey)) { logger.LogWarning("ODDS_API_KEY not set, skipping sync"); return; }

        using var http = new HttpClient();
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        foreach (var sportKey in SportKeys)
        {
            var url = $"https://api.the-odds-api.com/v4/sports/{sportKey}/odds/?apiKey={apiKey}&regions=uk&markets=h2h&oddsFormat=decimal&dateFormat=iso";
            var response = await http.GetStringAsync(url, ct);
            var events = JsonSerializer.Deserialize<List<ApiEvent>>(response, JsonOpts);
            if (events is null) continue;

            foreach (var evt in events)
            {
                // Check if match already exists (by external_id stored in sport field as "sport|externalId")
                var externalId = evt.Id;
                var existing = await db.Matches
                    .FirstOrDefaultAsync(m => m.Sport == externalId, ct);

                if (existing is null)
                {
                    // Determine status based on commence time
                    var status = evt.CommenceTime <= DateTime.UtcNow ? "live" : "upcoming";

                    var match = new Match
                    {
                        Sport = externalId, // store external ID here for dedup
                        SportTitle = evt.SportTitle,
                        TeamA = evt.HomeTeam,
                        TeamB = evt.AwayTeam,
                        StartTime = evt.CommenceTime,
                        Status = status,
                        CreatedAt = DateTime.UtcNow
                    };
                    db.Matches.Add(match);
                    await db.SaveChangesAsync(ct);

                    var market = new Market
                    {
                        MatchId = match.Id,
                        Name = "Match Winner",
                        Status = "open",
                        CreatedAt = DateTime.UtcNow
                    };
                    db.Markets.Add(market);
                    await db.SaveChangesAsync(ct);

                    // Get odds from first bookmaker
                    var bookmaker = evt.Bookmakers?.FirstOrDefault();
                    var h2h = bookmaker?.Markets?.FirstOrDefault(m => m.Key == "h2h");

                    if (h2h?.Outcomes != null)
                    {
                        foreach (var outcome in h2h.Outcomes)
                        {
                            db.Odds.Add(new Odd
                            {
                                MarketId = market.Id,
                                Outcome = outcome.Name,
                                BackPrice = outcome.Price,
                                LayPrice = Math.Round(outcome.Price + 0.05m, 2),
                                LastUpdated = DateTime.UtcNow
                            });
                        }
                        await db.SaveChangesAsync(ct);
                    }

                    logger.LogInformation("Added match: {Home} vs {Away}", evt.HomeTeam, evt.AwayTeam);

                    // Auto-create score prediction contest
                    db.ScoreContests.Add(new ScoreContest
                    {
                        MatchId = match.Id,
                        EntryFee = 100m,
                        MaxPlayers = 10,
                        Status = "open",
                        CreatedAt = DateTime.UtcNow
                    });
                    await db.SaveChangesAsync(ct);
                }
                else
                {
                    // Update odds for existing match
                    var market = await db.Markets
                        .Include(m => m.Odds)
                        .FirstOrDefaultAsync(m => m.MatchId == existing.Id, ct);

                    if (market is null) continue;

                    var bookmaker = evt.Bookmakers?.FirstOrDefault();
                    var h2h = bookmaker?.Markets?.FirstOrDefault(m => m.Key == "h2h");

                    if (h2h?.Outcomes != null)
                    {
                        foreach (var outcome in h2h.Outcomes)
                        {
                            var odd = market.Odds.FirstOrDefault(o => o.Outcome == outcome.Name);
                            if (odd != null && !odd.IsLocked)
                            {
                                odd.BackPrice = outcome.Price;
                                odd.LayPrice = Math.Round(outcome.Price + 0.05m, 2);
                                odd.LastUpdated = DateTime.UtcNow;
                            }
                        }
                        await db.SaveChangesAsync(ct);
                    }

                    // Update status
                    existing.Status = evt.CommenceTime <= DateTime.UtcNow ? "live" : "upcoming";
                    await db.SaveChangesAsync(ct);
                }
            }
        }

        logger.LogInformation("Odds sync completed");
    }
}

// API response models
public class ApiEvent
{
    public string Id { get; set; } = "";
    [System.Text.Json.Serialization.JsonPropertyName("sport_key")]
    public string SportKey { get; set; } = "";
    [System.Text.Json.Serialization.JsonPropertyName("sport_title")]
    public string SportTitle { get; set; } = "";
    [System.Text.Json.Serialization.JsonPropertyName("commence_time")]
    public DateTime CommenceTime { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("home_team")]
    public string HomeTeam { get; set; } = "";
    [System.Text.Json.Serialization.JsonPropertyName("away_team")]
    public string AwayTeam { get; set; } = "";
    public List<ApiBookmaker>? Bookmakers { get; set; }
}

public class ApiBookmaker
{
    public string Key { get; set; } = "";
    public List<ApiMarket>? Markets { get; set; }
}

public class ApiMarket
{
    public string Key { get; set; } = "";
    public List<ApiOutcome>? Outcomes { get; set; }
}

public class ApiOutcome
{
    public string Name { get; set; } = "";
    public decimal Price { get; set; }
}

