import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common'
import { readFile } from 'node:fs/promises'
import { arch, hostname, loadavg, platform, release, uptime } from 'node:os'
import { monitorEventLoopDelay } from 'node:perf_hooks'
import * as si from 'systeminformation'
import { systemMonitorConfig } from '../config'
import type { SystemMonitorConfigType } from '../config'

type SystemHealth = 'healthy' | 'warning' | 'critical'

type DiskSnapshot = DashboardSystemStatus['disks'][number]
type NetworkInterfaceSnapshot =
  DashboardSystemStatus['network']['interfaces'][number]

interface Counter {
  bytes: number
  iops: number
  at?: number
}

interface DiskCounters {
  read: Counter
  write: Counter
}

interface ProcessCounters {
  user: number
  system: number
  at: number
}

interface CgroupLimits {
  cpuCores: number | null
  cpuUsageMicros: number | null
  memoryTotal: number | null
  memoryUsed: number | null
}

interface SystemSample {
  sampledAt: Date
  cpuUsage: number
  memoryUsage: number
  inboundPerSecond: number
  outboundPerSecond: number
  diskReadPerSecond: number | null
  diskWritePerSecond: number | null
  disks: DiskSnapshot[]
  network: DashboardSystemStatus['network']
  cpu: DashboardSystemStatus['cpu']
  memory: DashboardSystemStatus['memory']
  process: DashboardSystemStatus['process']
  instance: DashboardSystemStatus['instance']
}

export interface DashboardSystemStatus {
  status: SystemHealth
  sampledAt: Date
  instance: {
    id: string
    hostname: string
    platform: string
    arch: string
    release: string
    uptime: number
    virtualization?: string | null
    containerized?: boolean
  }
  cpu: {
    usage: number
    cores: number
    physicalCores?: number | null
    model: string
    speedMHz?: number | null
    temperature?: number | null
    loadAverage: [number, number, number]
    perCore: Array<{
      index: number
      usage: number
      speedMHz?: number | null
      temperature?: number | null
    }>
  }
  memory: {
    total: number
    used: number
    available: number
    free: number
    active?: number | null
    cached?: number | null
    buffers?: number | null
    usage: number
    swap: { total: number; used: number; free: number; usage: number }
  }
  disks: Array<{
    device: string
    mount: string
    filesystem?: string | null
    type?: string | null
    total: number
    used: number
    available: number
    usage: number
    readPerSecond?: number | null
    writePerSecond?: number | null
    readIops?: number | null
    writeIops?: number | null
  }>
  network: {
    inboundPerSecond: number
    outboundPerSecond: number
    totalReceived?: number | null
    totalSent?: number | null
    interfaces: Array<{
      name: string
      state: 'up' | 'down' | 'unknown'
      type?: string | null
      speedMbps?: number | null
      inboundPerSecond: number
      outboundPerSecond: number
      totalReceived?: number | null
      totalSent?: number | null
    }>
  }
  process: {
    uptime: number
    cpuUsage: number
    rss: number
    heapUsed: number
    heapTotal: number
    external: number
    arrayBuffers: number
    nodeVersion: string
    activeHandles?: number | null
    activeRequests?: number | null
    eventLoopLag?: number | null
  }
  history: Array<{
    sampledAt: Date
    cpuUsage: number
    memoryUsage: number
    inboundPerSecond: number
    outboundPerSecond: number
    diskReadPerSecond?: number | null
    diskWritePerSecond?: number | null
  }>
}

@Injectable()
export class DashboardSystemService implements OnModuleInit, OnModuleDestroy {
  private readonly eventLoop = monitorEventLoopDelay({ resolution: 20 })
  private readonly history: SystemSample[] = []
  private readonly listeners = new Set<
    (status: DashboardSystemStatus) => void
  >()
  private previousNetwork = new Map<
    string,
    { received: number; sent: number; at: number }
  >()
  private previousDiskCounters = new Map<string, DiskCounters>()
  private previousProcess?: ProcessCounters
  private previousCgroupCpu?: { usageMicros: number; at: number }
  private timer?: NodeJS.Timeout
  private collecting?: Promise<void>
  private monitorUnavailable = false

  constructor(
    @Inject(systemMonitorConfig.KEY)
    private readonly config: SystemMonitorConfigType,
  ) {}

  async onModuleInit(): Promise<void> {
    this.eventLoop.enable()
    await this.collect()
    this.timer = setInterval(() => void this.collect(), this.config.intervalMs)
    this.timer.unref()
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer)
    this.eventLoop.disable()
  }

  getStatus(): DashboardSystemStatus {
    const latest = this.history.at(-1)
    if (!latest && this.monitorUnavailable) {
      throw new ServiceUnavailableException('系统监控采样暂不可用')
    }
    if (!latest) return this.emptyStatus()
    const eventLoopLag = this.eventLoopLag()
    return {
      status: this.resolveStatus(
        latest.cpu.usage,
        latest.memory.usage,
        latest.disks,
        eventLoopLag,
      ),
      sampledAt: latest.sampledAt,
      instance: latest.instance,
      cpu: latest.cpu,
      memory: latest.memory,
      disks: latest.disks,
      network: latest.network,
      process: { ...latest.process, eventLoopLag },
      history: this.history.map((sample) => ({
        sampledAt: sample.sampledAt,
        cpuUsage: sample.cpuUsage,
        memoryUsage: sample.memoryUsage,
        inboundPerSecond: sample.inboundPerSecond,
        outboundPerSecond: sample.outboundPerSecond,
        diskReadPerSecond: sample.diskReadPerSecond,
        diskWritePerSecond: sample.diskWritePerSecond,
      })),
    }
  }

  subscribe(listener: (status: DashboardSystemStatus) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private async collect(): Promise<void> {
    if (this.collecting) return this.collecting
    this.collecting = this.collectSnapshot()
      .catch(() => {
        // Keep the last good snapshot.  Monitoring must never affect the
        // dashboard overview, weather endpoint, or the rest of the API.
        if (!this.history.length) this.monitorUnavailable = true
      })
      .finally(() => {
        this.collecting = undefined
      })
    return this.collecting
  }

  private async collectSnapshot(): Promise<void> {
    const sampledAt = new Date()
    const [cpu, load, speed, temperature, memory, disks, interfaces, net] =
      await this.withTimeout(
        Promise.all([
          si.cpu(),
          si.currentLoad(),
          si.cpuCurrentSpeed(),
          si.cpuTemperature(),
          si.mem(),
          this.safeFsSize(),
          this.safeInterfaces(),
          this.safeNetworkStats(),
        ]),
      )
    const limits = await this.cgroupLimits()
    const cpuSnapshot = this.cpuSnapshot(
      cpu,
      load,
      speed,
      temperature,
      limits.cpuCores,
      limits.cpuUsageMicros,
      sampledAt.getTime(),
    )
    const memorySnapshot = this.memorySnapshot(
      memory,
      limits.memoryTotal,
      limits.memoryUsed,
    )
    const diskCounters = await this.diskCounters()
    const diskSnapshot = this.diskSnapshot(
      disks,
      diskCounters,
      sampledAt.getTime(),
    )
    const networkSnapshot = this.networkSnapshot(
      interfaces,
      net,
      sampledAt.getTime(),
    )
    const process = this.processSnapshot(sampledAt.getTime())
    const sample: SystemSample = {
      sampledAt,
      cpuUsage: cpuSnapshot.usage,
      memoryUsage: memorySnapshot.usage,
      inboundPerSecond: networkSnapshot.inboundPerSecond,
      outboundPerSecond: networkSnapshot.outboundPerSecond,
      diskReadPerSecond: this.sumNullable(diskSnapshot, 'readPerSecond'),
      diskWritePerSecond: this.sumNullable(diskSnapshot, 'writePerSecond'),
      disks: diskSnapshot,
      network: networkSnapshot,
      cpu: cpuSnapshot,
      memory: memorySnapshot,
      process,
      instance: await this.instanceSnapshot(),
    }
    this.history.push(sample)
    const historySize = this.config.historySize ?? 60
    if (this.history.length > historySize)
      this.history.splice(0, this.history.length - historySize)
    this.monitorUnavailable = false
    const status = this.getStatus()
    for (const listener of this.listeners) listener(status)
  }

  private async withTimeout<T>(promise: Promise<T>): Promise<T> {
    const timeout = new Promise<never>((_, reject) => {
      const timer = setTimeout(
        () => reject(new Error('System monitor collection timed out')),
        Math.min((this.config.intervalMs ?? 3000) - 100, 10_000),
      )
      timer.unref()
    })
    return Promise.race([promise, timeout])
  }

  private cpuSnapshot(
    cpu: si.Systeminformation.CpuData,
    load: si.Systeminformation.CurrentLoadData,
    speed: si.Systeminformation.CpuCurrentSpeedData,
    temperature: si.Systeminformation.CpuTemperatureData,
    cgroupCores: number | null,
    cgroupUsageMicros: number | null,
    now: number,
  ): DashboardSystemStatus['cpu'] {
    const availableCores = cgroupCores
      ? Math.min(load.cpus.length || 1, Math.max(1, Math.ceil(cgroupCores)))
      : load.cpus.length || Math.max(1, cpu.cores)
    const perCore = load.cpus.slice(0, availableCores).map((item, index) => ({
      index,
      usage: this.percent(item.load / 100),
      speedMHz: this.nullableNumber(speed.cores[index]),
      temperature: this.nullableNumber(temperature.cores[index]),
    }))
    const cgroupUsage = this.cgroupCpuUsage(cgroupUsageMicros, cgroupCores, now)
    return {
      usage: cgroupUsage ?? this.percent(load.currentLoad / 100),
      cores: availableCores,
      physicalCores: cpu.physicalCores > 0 ? cpu.physicalCores : null,
      model: cpu.brand || cpu.manufacturer || 'Unknown',
      speedMHz: this.nullableNumber(speed.avg),
      temperature: this.nullableNumber(temperature.main),
      loadAverage: this.loadAverage(),
      perCore,
    }
  }

  private memorySnapshot(
    memory: si.Systeminformation.MemData,
    cgroupTotal: number | null,
    cgroupUsed: number | null,
  ): DashboardSystemStatus['memory'] {
    const hostTotal = this.nonNegative(memory.total)
    const total =
      cgroupTotal && cgroupTotal > 0
        ? Math.min(hostTotal, cgroupTotal)
        : hostTotal
    const used = Math.min(total, this.nonNegative(cgroupUsed ?? memory.used))
    const available = Math.max(0, total - used)
    const free = Math.min(total, this.nonNegative(memory.free))
    const swapTotal = this.nonNegative(memory.swaptotal)
    const swapUsed = Math.min(swapTotal, this.nonNegative(memory.swapused))
    return {
      total,
      used,
      available,
      free,
      active: this.nullableNumber(memory.active),
      cached: this.nullableNumber(memory.cached),
      buffers: this.nullableNumber(memory.buffers),
      usage: total ? this.percent(used / total) : 0,
      swap: {
        total: swapTotal,
        used: swapUsed,
        free: Math.max(0, swapTotal - swapUsed),
        usage: swapTotal ? this.percent(swapUsed / swapTotal) : 0,
      },
    }
  }

  private diskSnapshot(
    disks: si.Systeminformation.FsSizeData[],
    counters: Map<string, DiskCounters>,
    now: number,
  ): DiskSnapshot[] {
    const snapshots = disks
      .filter((disk) => this.isBusinessDisk(disk))
      .map((disk) => {
        const device = disk.fs || disk.mount
        const current = counters.get(this.diskKey(device))
        const previous = this.previousDiskCounters.get(this.diskKey(device))
        const elapsed = this.elapsed(previous?.read, current?.read, now)
        return {
          device,
          mount: disk.mount,
          filesystem: disk.type || null,
          type: this.diskType(device),
          total: this.nonNegative(disk.size),
          used: this.nonNegative(disk.used),
          available: this.nonNegative(disk.available),
          usage: this.percent((disk.use ?? 0) / 100),
          readPerSecond: this.counterRate(
            current?.read.bytes,
            previous?.read.bytes,
            elapsed,
          ),
          writePerSecond: this.counterRate(
            current?.write.bytes,
            previous?.write.bytes,
            elapsed,
          ),
          readIops: this.counterRate(
            current?.read.iops,
            previous?.read.iops,
            elapsed,
          ),
          writeIops: this.counterRate(
            current?.write.iops,
            previous?.write.iops,
            elapsed,
          ),
        }
      })
      .sort((left, right) => left.mount.localeCompare(right.mount))
    for (const [key, value] of counters) {
      this.previousDiskCounters.set(key, {
        read: { ...value.read, at: now },
        write: { ...value.write, at: now },
      })
    }
    return snapshots
  }

  private networkSnapshot(
    interfaces: si.Systeminformation.NetworkInterfacesData[],
    stats: si.Systeminformation.NetworkStatsData[],
    now: number,
  ): DashboardSystemStatus['network'] {
    const metadata = new Map(interfaces.map((item) => [item.iface, item]))
    const rows: NetworkInterfaceSnapshot[] = stats
      .filter((item) =>
        this.isBusinessInterface(item.iface, metadata.get(item.iface)),
      )
      .map((item) => {
        const previous = this.previousNetwork.get(item.iface)
        const elapsed = previous
          ? Math.max((now - previous.at) / 1000, 0.001)
          : null
        const received = this.nonNegative(item.rx_bytes)
        const sent = this.nonNegative(item.tx_bytes)
        const interfaceMeta = metadata.get(item.iface)
        this.previousNetwork.set(item.iface, { received, sent, at: now })
        return {
          name: item.iface,
          state: this.networkState(item.operstate),
          type: interfaceMeta?.type || null,
          speedMbps: this.nullableNumber(interfaceMeta?.speed ?? undefined),
          inboundPerSecond:
            this.counterRate(received, previous?.received, elapsed) ?? 0,
          outboundPerSecond:
            this.counterRate(sent, previous?.sent, elapsed) ?? 0,
          totalReceived: received,
          totalSent: sent,
        }
      })
      .sort((left, right) => left.name.localeCompare(right.name))
    return {
      inboundPerSecond: this.round(
        rows.reduce((sum, item) => sum + item.inboundPerSecond, 0),
      ),
      outboundPerSecond: this.round(
        rows.reduce((sum, item) => sum + item.outboundPerSecond, 0),
      ),
      totalReceived: rows.reduce(
        (sum, item) => sum + (item.totalReceived ?? 0),
        0,
      ),
      totalSent: rows.reduce((sum, item) => sum + (item.totalSent ?? 0), 0),
      interfaces: rows,
    }
  }

  private processSnapshot(now: number): DashboardSystemStatus['process'] {
    const resource = process.cpuUsage()
    const current = { user: resource.user, system: resource.system, at: now }
    const previous = this.previousProcess
    this.previousProcess = current
    const elapsedMicros = previous ? Math.max((now - previous.at) * 1000, 1) : 0
    const cpuUsage = previous
      ? this.percent(
          (current.user - previous.user + current.system - previous.system) /
            elapsedMicros,
        )
      : 0
    const memory = process.memoryUsage()
    const processWithInternals = process as typeof process & {
      _getActiveHandles?: () => unknown[]
      _getActiveRequests?: () => unknown[]
    }
    return {
      uptime: this.nonNegative(process.uptime()),
      cpuUsage,
      rss: this.nonNegative(memory.rss),
      heapUsed: this.nonNegative(memory.heapUsed),
      heapTotal: this.nonNegative(memory.heapTotal),
      external: this.nonNegative(memory.external),
      arrayBuffers: this.nonNegative(memory.arrayBuffers),
      nodeVersion: process.version,
      activeHandles: processWithInternals._getActiveHandles?.().length ?? null,
      activeRequests:
        processWithInternals._getActiveRequests?.().length ?? null,
    }
  }

  private async instanceSnapshot(): Promise<DashboardSystemStatus['instance']> {
    const containerized = await this.isContainerized()
    return {
      id: this.config.instanceId,
      hostname: this.config.instanceHostname || hostname(),
      platform: platform(),
      arch: arch(),
      release: release(),
      uptime: this.nonNegative(uptime()),
      virtualization: containerized ? 'container' : null,
      containerized,
    }
  }

  private async cgroupLimits(): Promise<CgroupLimits> {
    if (platform() !== 'linux') {
      return {
        cpuCores: null,
        cpuUsageMicros: null,
        memoryTotal: null,
        memoryUsed: null,
      }
    }
    const [
      cpuMax,
      cpuQuota,
      cpuPeriod,
      cpuStat,
      memoryMax,
      memoryLimit,
      memoryCurrent,
      memoryUsage,
    ] = await Promise.all([
      this.readOptional('/sys/fs/cgroup/cpu.max'),
      this.readOptional('/sys/fs/cgroup/cpu/cpu.cfs_quota_us'),
      this.readOptional('/sys/fs/cgroup/cpu/cpu.cfs_period_us'),
      this.readOptional('/sys/fs/cgroup/cpu.stat'),
      this.readOptional('/sys/fs/cgroup/memory.max'),
      this.readOptional('/sys/fs/cgroup/memory/memory.limit_in_bytes'),
      this.readOptional('/sys/fs/cgroup/memory.current'),
      this.readOptional('/sys/fs/cgroup/memory/memory.usage_in_bytes'),
    ])
    const v2 = cpuMax?.trim().split(/\s+/)
    const cpuV2 = v2 && v2[0] !== 'max' ? Number(v2[0]) / Number(v2[1]) : null
    const cpuV1 =
      cpuQuota && cpuPeriod && Number(cpuQuota) > 0
        ? Number(cpuQuota) / Number(cpuPeriod)
        : null
    const rawMemory =
      memoryMax?.trim() === 'max' ? memoryLimit : (memoryMax ?? memoryLimit)
    const memory = rawMemory ? Number(rawMemory.trim()) : null
    const cpuUsage = cpuStat?.match(/^usage_usec\s+(\d+)$/m)?.[1]
    const rawMemoryUsed = memoryCurrent ?? memoryUsage
    return {
      cpuCores: this.validLimit(cpuV2) ?? this.validLimit(cpuV1),
      cpuUsageMicros: this.validLimit(cpuUsage ? Number(cpuUsage) : null),
      memoryTotal: this.validLimit(memory),
      memoryUsed: this.validLimit(
        rawMemoryUsed ? Number(rawMemoryUsed.trim()) : null,
      ),
    }
  }

  private async diskCounters(): Promise<Map<string, DiskCounters>> {
    if (platform() !== 'linux') return new Map()
    const source = await this.readOptional('/proc/diskstats')
    if (!source) return new Map()
    const rows = new Map<string, DiskCounters>()
    for (const line of source.split('\n')) {
      const values = line.trim().split(/\s+/)
      if (values.length < 11) continue
      const name = values[2]
      if (!name || name.startsWith('loop') || name.startsWith('ram')) continue
      const readIops = Number(values[3])
      const readSectors = Number(values[5])
      const writeIops = Number(values[7])
      const writeSectors = Number(values[9])
      rows.set(name, {
        read: {
          bytes: this.nonNegative(readSectors * 512),
          iops: this.nonNegative(readIops),
        },
        write: {
          bytes: this.nonNegative(writeSectors * 512),
          iops: this.nonNegative(writeIops),
        },
      })
    }
    return rows
  }

  private async safeFsSize(): Promise<si.Systeminformation.FsSizeData[]> {
    try {
      return await si.fsSize()
    } catch {
      return []
    }
  }

  private async safeInterfaces(): Promise<
    si.Systeminformation.NetworkInterfacesData[]
  > {
    try {
      return await si.networkInterfaces()
    } catch {
      return []
    }
  }

  private async safeNetworkStats(): Promise<
    si.Systeminformation.NetworkStatsData[]
  > {
    try {
      return await si.networkStats()
    } catch {
      return []
    }
  }

  private async isContainerized(): Promise<boolean> {
    if (platform() !== 'linux') return false
    const cgroup = await this.readOptional('/proc/1/cgroup')
    return Boolean(
      cgroup && /(docker|containerd|kubepods|podman)/i.test(cgroup),
    )
  }

  private async readOptional(path: string): Promise<string | null> {
    try {
      return await readFile(path, 'utf8')
    } catch {
      return null
    }
  }

  private emptyStatus(): DashboardSystemStatus {
    const instance = {
      id: this.config.instanceId,
      hostname: this.config.instanceHostname || hostname(),
      platform: platform(),
      arch: arch(),
      release: release(),
      uptime: this.nonNegative(uptime()),
      virtualization: null,
      containerized: false,
    }
    const memory = {
      total: 0,
      used: 0,
      available: 0,
      free: 0,
      active: null,
      cached: null,
      buffers: null,
      usage: 0,
      swap: { total: 0, used: 0, free: 0, usage: 0 },
    }
    return {
      status: 'healthy',
      sampledAt: new Date(),
      instance,
      cpu: {
        usage: 0,
        cores: 1,
        physicalCores: null,
        model: 'Unknown',
        speedMHz: null,
        temperature: null,
        loadAverage: [0, 0, 0],
        perCore: [{ index: 0, usage: 0, speedMHz: null, temperature: null }],
      },
      memory,
      disks: [],
      network: {
        inboundPerSecond: 0,
        outboundPerSecond: 0,
        totalReceived: null,
        totalSent: null,
        interfaces: [],
      },
      process: {
        ...this.processSnapshot(Date.now()),
        eventLoopLag: this.eventLoopLag(),
      },
      history: [],
    }
  }

  private elapsed(
    previous: Counter | undefined,
    current: Counter | undefined,
    now: number,
  ): number | null {
    if (!previous || !current) return null
    const previousAt = previous.at
    return previousAt ? Math.max((now - previousAt) / 1000, 0.001) : null
  }

  private counterRate(
    current: number | undefined,
    previous: number | undefined,
    elapsed: number | null,
  ): number | null {
    if (current === undefined || previous === undefined || !elapsed) return null
    return this.round(Math.max(0, current - previous) / elapsed)
  }

  private sumNullable(
    items: DiskSnapshot[],
    key: 'readPerSecond' | 'writePerSecond',
  ): number | null {
    const values = items
      .map((item) => item[key])
      .filter((value): value is number => value !== null && value !== undefined)
    return values.length
      ? this.round(values.reduce((sum, value) => sum + value, 0))
      : null
  }

  private isBusinessDisk(disk: si.Systeminformation.FsSizeData): boolean {
    return (
      Boolean(disk.mount) &&
      disk.rw !== false &&
      !/^(tmpfs|devtmpfs|overlay|squashfs)$/i.test(disk.type || '') &&
      !/(^\/dev\/loop|^\/dev\/ram)/.test(disk.fs || '')
    )
  }

  private isBusinessInterface(
    name: string,
    item?: si.Systeminformation.NetworkInterfacesData,
  ): boolean {
    return (
      name !== 'lo' &&
      !item?.internal &&
      !item?.virtual &&
      !/^(docker|veth|br-|virbr|cni|flannel)/i.test(name)
    )
  }

  private diskKey(device: string): string {
    const value = device.replace(/^\/dev\//, '')
    return value.replace(/p?\d+$/, '')
  }

  private diskType(device: string): string | null {
    if (/nvme/i.test(device)) return 'NVMe'
    if (/sd|vd|xvd/i.test(device)) return 'disk'
    return null
  }

  private networkState(value: string): 'up' | 'down' | 'unknown' {
    return /^up$/i.test(value)
      ? 'up'
      : /^down$/i.test(value)
        ? 'down'
        : 'unknown'
  }

  private eventLoopLag(): number | null {
    const mean = this.eventLoop.mean / 1_000_000
    return Number.isFinite(mean) && mean >= 0 ? this.round(mean) : null
  }

  private cgroupCpuUsage(
    usageMicros: number | null,
    cores: number | null,
    now: number,
  ): number | null {
    if (!usageMicros || !cores) return null
    const previous = this.previousCgroupCpu
    this.previousCgroupCpu = { usageMicros, at: now }
    if (!previous) return null
    const elapsedMicros = Math.max((now - previous.at) * 1000, 1)
    return this.percent(
      (usageMicros - previous.usageMicros) / (elapsedMicros * cores),
    )
  }

  private resolveStatus(
    cpu: number,
    memory: number,
    disks: DiskSnapshot[],
    eventLoopLag: number | null,
  ): SystemHealth {
    const level = Math.max(
      this.level(
        cpu,
        this.config.cpuWarning ?? 75,
        this.config.cpuCritical ?? 90,
      ),
      this.level(
        memory,
        this.config.memoryWarning ?? 75,
        this.config.memoryCritical ?? 90,
      ),
      ...disks.map((disk) =>
        this.level(
          disk.usage,
          this.config.diskWarning ?? 75,
          this.config.diskCritical ?? 90,
        ),
      ),
      eventLoopLag === null
        ? 0
        : this.level(
            eventLoopLag,
            this.config.eventLoopWarningMs ?? 100,
            this.config.eventLoopCriticalMs ?? 500,
          ),
    )
    return level >= 2 ? 'critical' : level === 1 ? 'warning' : 'healthy'
  }

  private level(value: number, warning: number, critical: number): number {
    if (value >= critical) return 2
    return value >= warning ? 1 : 0
  }

  private loadAverage(): [number, number, number] {
    const values = loadavg().map((value) => this.nonNegative(value))
    return [values[0] ?? 0, values[1] ?? 0, values[2] ?? 0]
  }

  private percent(value: number): number {
    return this.round(Math.max(0, Math.min(100, value * 100)))
  }
  private nonNegative(value: number): number {
    return Number.isFinite(value) && value >= 0 ? value : 0
  }
  private nullableNumber(value: number | undefined): number | null {
    return value !== undefined && Number.isFinite(value) && value >= 0
      ? this.round(value)
      : null
  }
  private validLimit(value: number | null): number | null {
    return value !== null &&
      Number.isFinite(value) &&
      value > 0 &&
      value < Number.MAX_SAFE_INTEGER
      ? value
      : null
  }
  private round(value: number): number {
    return Math.round(value * 10) / 10
  }
}
