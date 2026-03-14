using Microsoft.EntityFrameworkCore;
using SkyExchange.Models;

namespace SkyExchange.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Match> Matches => Set<Match>();
    public DbSet<Market> Markets => Set<Market>();
    public DbSet<Odd> Odds => Set<Odd>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<Trade> Trades => Set<Trade>();
    public DbSet<DigitBet> DigitBets => Set<DigitBet>();
    public DbSet<ScoreContest> ScoreContests => Set<ScoreContest>();
    public DbSet<ScorePrediction> ScorePredictions => Set<ScorePrediction>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Market>()
            .HasOne(m => m.Match).WithMany(m => m.Markets).HasForeignKey(m => m.MatchId);

        modelBuilder.Entity<Odd>()
            .HasOne(o => o.Market).WithMany(m => m.Odds).HasForeignKey(o => o.MarketId);

        modelBuilder.Entity<Order>(e =>
        {
            e.HasOne(o => o.User).WithMany().HasForeignKey(o => o.UserId);
            e.HasOne(o => o.Odd).WithMany().HasForeignKey(o => o.OddsId);
        });

        modelBuilder.Entity<User>()
            .Property(u => u.Version).IsConcurrencyToken();

        modelBuilder.Entity<Trade>(e =>
        {
            e.HasOne(t => t.BackOrder).WithMany().HasForeignKey(t => t.BackOrderId);
            e.HasOne(t => t.LayOrder).WithMany().HasForeignKey(t => t.LayOrderId);
            e.HasOne(t => t.Odd).WithMany().HasForeignKey(t => t.OddsId);
        });
        modelBuilder.Entity<DigitBet>(e =>
        {
            e.HasOne(d => d.User).WithMany().HasForeignKey(d => d.UserId);
            e.HasOne(d => d.Match).WithMany().HasForeignKey(d => d.MatchId);
        });

        modelBuilder.Entity<ScoreContest>(e =>
        {
            e.HasOne(c => c.Match).WithMany().HasForeignKey(c => c.MatchId);
            e.HasMany(c => c.Predictions).WithOne(p => p.Contest).HasForeignKey(p => p.ContestId);
        });

        modelBuilder.Entity<ScorePrediction>(e =>
        {
            e.HasOne(p => p.User).WithMany().HasForeignKey(p => p.UserId);
        });
    }
}