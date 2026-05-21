using BaseCore.Repository;
using Microsoft.EntityFrameworkCore;

namespace BaseCore.APIService.Services
{
    public class ExpiredSeatHoldCleanupService : BackgroundService
    {
        private const string HoldingStatus = "Holding";
        private const string ExpiredStatus = "Expired";
        private static readonly TimeSpan RunInterval = TimeSpan.FromMinutes(1);

        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<ExpiredSeatHoldCleanupService> _logger;

        public ExpiredSeatHoldCleanupService(
            IServiceScopeFactory scopeFactory,
            ILogger<ExpiredSeatHoldCleanupService> logger)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("ExpiredSeatHoldCleanupService started.");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await CleanupAsync(stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error while expiring seat holds.");
                }

                await Task.Delay(RunInterval, stoppingToken);
            }
        }

        private async Task CleanupAsync(CancellationToken ct)
        {
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<MySqlDbContext>();
            var now = DateTime.Now;

            var expiredHolds = await context.SeatHolds
                .Where(x =>
                    x.Status == HoldingStatus &&
                    x.HoldExpiresAt <= now)
                .ToListAsync(ct);

            if (expiredHolds.Count == 0)
                return;

            foreach (var hold in expiredHolds)
            {
                hold.Status = ExpiredStatus;
            }

            await context.SaveChangesAsync(ct);
            _logger.LogInformation("Expired {Count} seat holds.", expiredHolds.Count);
        }
    }
}
