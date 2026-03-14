using Microsoft.AspNetCore.SignalR;

namespace SkyExchange.Hubs;

public class OddsHub : Hub
{
    public async Task JoinMatch(int matchId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"match-{matchId}");
    }

    public async Task LeaveMatch(int matchId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"match-{matchId}");
    }

    public async Task JoinUser(int userId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"user-{userId}");
    }
}
