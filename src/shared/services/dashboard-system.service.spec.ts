import { DashboardSystemService } from './dashboard-system.service'

describe('DashboardSystemService', () => {
  it('returns a sanitized, finite monitoring snapshot with history', async () => {
    const service = new DashboardSystemService({
      instanceId: 'cms-api-test',
      instanceHostname: 'cms-test',
      historySize: 30,
      intervalMs: 60000,
      cpuWarning: 75,
      cpuCritical: 90,
      memoryWarning: 75,
      memoryCritical: 90,
      diskWarning: 75,
      diskCritical: 90,
      eventLoopWarningMs: 100,
      eventLoopCriticalMs: 500,
    })

    await service.onModuleInit()
    const status = service.getStatus()
    service.onModuleDestroy()

    expect(status.instance).toMatchObject({
      id: 'cms-api-test',
      hostname: 'cms-test',
    })
    expect(status.history).toHaveLength(1)
    expect(status.cpu.usage).toBeGreaterThanOrEqual(0)
    expect(status.cpu.usage).toBeLessThanOrEqual(100)
    expect(status.memory.usage).toBeGreaterThanOrEqual(0)
    expect(status.memory.usage).toBeLessThanOrEqual(100)
    expect(status.network.inboundPerSecond).toBeGreaterThanOrEqual(0)
    expect(status.network.outboundPerSecond).toBeGreaterThanOrEqual(0)
    expect(JSON.stringify(status)).not.toContain('DATABASE_PASSWORD')
    expect(JSON.stringify(status)).not.toContain('process.argv')
  })
})
