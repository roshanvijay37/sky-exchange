using Microsoft.AspNetCore.SignalR;

namespace SkyExchange.Hubs;

public class OddsHub : Hub
{
    // Client can join a specific match's odds feed
    public async Task JoinMatch(int matchId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"match-{matchId}");
    }

    // Client can leave a match's odds feed
    public async Task LeaveMatch(int matchId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"match-{matchId}");
    }
}
