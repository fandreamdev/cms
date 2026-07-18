import { ConfigType, registerAs } from '@nestjs/config'
import Joi from 'joi'
import { envNumber, envString } from '../utils/env'

export const SYSTEM_MONITOR_KEY = 'systemMonitor'

export const systemMonitorConfig = registerAs(SYSTEM_MONITOR_KEY, () => ({
  instanceId: envString('SYSTEM_INSTANCE_ID', 'cms-api'),
  instanceHostname: envString('SYSTEM_INSTANCE_HOSTNAME'),
  historySize: envNumber('SYSTEM_MONITOR_HISTORY_SIZE', 60),
  intervalMs: envNumber('SYSTEM_MONITOR_INTERVAL_MS', 3000),
  maxConnectionsPerUser: envNumber(
    'SYSTEM_MONITOR_MAX_CONNECTIONS_PER_USER',
    3,
  ),
  cpuWarning: envNumber('SYSTEM_MONITOR_CPU_WARNING', 75),
  cpuCritical: envNumber('SYSTEM_MONITOR_CPU_CRITICAL', 90),
  memoryWarning: envNumber('SYSTEM_MONITOR_MEMORY_WARNING', 75),
  memoryCritical: envNumber('SYSTEM_MONITOR_MEMORY_CRITICAL', 90),
  diskWarning: envNumber('SYSTEM_MONITOR_DISK_WARNING', 75),
  diskCritical: envNumber('SYSTEM_MONITOR_DISK_CRITICAL', 90),
  eventLoopWarningMs: envNumber('SYSTEM_MONITOR_EVENT_LOOP_WARNING_MS', 100),
  eventLoopCriticalMs: envNumber('SYSTEM_MONITOR_EVENT_LOOP_CRITICAL_MS', 500),
}))

export type SystemMonitorConfigType = ConfigType<typeof systemMonitorConfig>

const percent = Joi.number().min(0).max(100)

export const systemMonitorSchema = {
  SYSTEM_INSTANCE_ID: Joi.string().trim().min(1).default('cms-api'),
  SYSTEM_INSTANCE_HOSTNAME: Joi.string().trim().allow('').optional(),
  SYSTEM_MONITOR_HISTORY_SIZE: Joi.number()
    .integer()
    .min(1)
    .max(60)
    .default(60),
  SYSTEM_MONITOR_INTERVAL_MS: Joi.number()
    .integer()
    .min(1000)
    .max(300000)
    .default(3000),
  SYSTEM_MONITOR_MAX_CONNECTIONS_PER_USER: Joi.number()
    .integer()
    .min(1)
    .max(10)
    .default(3),
  SYSTEM_MONITOR_CPU_WARNING: percent.default(75),
  SYSTEM_MONITOR_CPU_CRITICAL: percent.default(90),
  SYSTEM_MONITOR_MEMORY_WARNING: percent.default(75),
  SYSTEM_MONITOR_MEMORY_CRITICAL: percent.default(90),
  SYSTEM_MONITOR_DISK_WARNING: percent.default(75),
  SYSTEM_MONITOR_DISK_CRITICAL: percent.default(90),
  SYSTEM_MONITOR_EVENT_LOOP_WARNING_MS: Joi.number().min(0).default(100),
  SYSTEM_MONITOR_EVENT_LOOP_CRITICAL_MS: Joi.number().min(0).default(500),
}
