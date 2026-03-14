using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SkyExchange.Models;

[Table("users")]
public class User
{
    [Key, Column("id")] public int Id { get; set; }
    [Column("username")] public string Username { get; set; } = "";
    [Column("password_hash")] public string PasswordHash { get; set; } = "";
    [Column("balance")] public decimal Balance { get; set; }
    [Column("is_admin")] public bool IsAdmin { get; set; }
    [Column("is_suspended")] public bool IsSuspended { get; set; }
    [Column("version")] public int Version { get; set; }
    [Column("created_at")] public DateTime CreatedAt { get; set; }
}

[Table("matches")]
public class Match
{
    [Key, Column("id")] public int Id { get; set; }
    [Column("sport")] public string Sport { get; set; } = "";
    [Column("sport_title")] public string SportTitle { get; set; } = "";
    [Column("team_a")] public string TeamA { get; set; } = "";
    [Column("team_b")] public string TeamB { get; set; } = "";
    [Column("start_time")] public DateTime StartTime { get; set; }
    [Column("status")] public string Status { get; set; } = "upcoming";
    [Column("winning_outcome")] public string? WinningOutcome { get; set; }
    [Column("is_visible")] public bool IsVisible { get; set; } = true;
    [Column("is_locked")] public bool IsLocked { get; set; }
    [Column("is_locked_winlose")] public bool IsLockedWinlose { get; set; }
    [Column("is_locked_digit")] public bool IsLockedDigit { get; set; }
    [Column("is_locked_predict")] public bool IsLockedPredict { get; set; }
    [Column("created_at")] public DateTime CreatedAt { get; set; }
    public List<Market> Markets { get; set; } = [];
}

[Table("markets")]
public class Market
{
    [Key, Column("id")] public int Id { get; set; }
    [Column("match_id")] public int MatchId { get; set; }
    [Column("name")] public string Name { get; set; } = "";
    [Column("status")] public string Status { get; set; } = "open";
    [Column("created_at")] public DateTime CreatedAt { get; set; }
    public Match Match { get; set; } = null!;
    public List<Odd> Odds { get; set; } = [];
}

[Table("odds")]
public class Odd
{
    [Key, Column("id")] public int Id { get; set; }
    [Column("market_id")] public int MarketId { get; set; }
    [Column("outcome")] public string Outcome { get; set; } = "";
    [Column("back_price")] public decimal BackPrice { get; set; }
    [Column("lay_price")] public decimal LayPrice { get; set; }
    [Column("is_locked")] public bool IsLocked { get; set; }
    [Column("last_updated")] public DateTime LastUpdated { get; set; }
    public Market Market { get; set; } = null!;
}

[Table("orders")]
public class Order
{
    [Key, Column("id")] public int Id { get; set; }
    [Column("user_id")] public int UserId { get; set; }
    [Column("odds_id")] public int OddsId { get; set; }
    [Column("side")] public string Side { get; set; } = "";
    [Column("price")] public decimal Price { get; set; }
    [Column("stake")] public decimal Stake { get; set; }
    [Column("status")] public string Status { get; set; } = "pending";
    [Column("created_at")] public DateTime CreatedAt { get; set; }
    public User User { get; set; } = null!;
    public Odd Odd { get; set; } = null!;
}

[Table("trades")]
public class Trade
{
    [Key, Column("id")] public int Id { get; set; }
    [Column("back_order_id")] public int BackOrderId { get; set; }
    [Column("lay_order_id")] public int LayOrderId { get; set; }
    [Column("odds_id")] public int OddsId { get; set; }
    [Column("price")] public decimal Price { get; set; }
    [Column("stake")] public decimal Stake { get; set; }
    [Column("created_at")] public DateTime CreatedAt { get; set; }
    public Order BackOrder { get; set; } = null!;
    public Order LayOrder { get; set; } = null!;
    public Odd Odd { get; set; } = null!;
}

[Table("digit_bets")]
public class DigitBet
{
    [Key, Column("id")] public int Id { get; set; }
    [Column("user_id")] public int UserId { get; set; }
    [Column("match_id")] public int MatchId { get; set; }
    [Column("team")] public string Team { get; set; } = "";
    [Column("digit")] public int Digit { get; set; }
    [Column("stake")] public decimal Stake { get; set; }
    [Column("status")] public string Status { get; set; } = "pending";
    [Column("payout")] public decimal Payout { get; set; }
    [Column("created_at")] public DateTime CreatedAt { get; set; }
    public User User { get; set; } = null!;
    public Match Match { get; set; } = null!;
}

[Table("score_contests")]
public class ScoreContest
{
    [Key, Column("id")] public int Id { get; set; }
    [Column("match_id")] public int MatchId { get; set; }
    [Column("entry_fee")] public decimal EntryFee { get; set; } = 100m;
    [Column("max_players")] public int MaxPlayers { get; set; } = 10;
    [Column("status")] public string Status { get; set; } = "open";
    [Column("actual_score_a")] public int? ActualScoreA { get; set; }
    [Column("actual_score_b")] public int? ActualScoreB { get; set; }
    [Column("created_at")] public DateTime CreatedAt { get; set; }
    public Match Match { get; set; } = null!;
    public List<ScorePrediction> Predictions { get; set; } = [];
}

[Table("score_predictions")]
public class ScorePrediction
{
    [Key, Column("id")] public int Id { get; set; }
    [Column("contest_id")] public int ContestId { get; set; }
    [Column("user_id")] public int UserId { get; set; }
    [Column("predicted_score_a")] public int PredictedScoreA { get; set; }
    [Column("predicted_score_b")] public int PredictedScoreB { get; set; }
    [Column("difference")] public int? Difference { get; set; }
    [Column("rank")] public int? Rank { get; set; }
    [Column("payout")] public decimal Payout { get; set; }
    [Column("created_at")] public DateTime CreatedAt { get; set; }
    public ScoreContest Contest { get; set; } = null!;
    public User User { get; set; } = null!;
}
