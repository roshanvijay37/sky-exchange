using Microsoft.EntityFrameworkCore;
using SkyExchange.Data;
using SkyExchange.Hubs;
using SkyExchange.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddOpenApi();

// Register PostgreSQL database
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// Register SignalR for real-time WebSocket communication
builder.Services.AddSignalR();

// Register the background odds engine
builder.Services.AddHostedService<OddsEngine>();

// Allow frontend to call our API and connect to SignalR
builder.Services.AddCors(options =>
    options.AddDefaultPolicy(policy =>
        policy.WithOrigins("http://localhost:3000")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials()));

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors();
app.UseAuthorization();
app.MapControllers();

// Map the SignalR hub endpoint
app.MapHub<OddsHub>("/hubs/odds");

app.Run();
