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
    }
}
