import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class AnalyticsCacheService {
  private readonly logger = new Logger(AnalyticsCacheService.name);

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.cacheManager.get<T>(key);
      return value || null;
    } catch (error) {
      this.logger.error(`Redis Get Error for key ${key}`, error);
      return null; // Fallback: return null if cache fails
    }
  }

  async set<T>(key: string, value: T, ttlMs: number = 60000): Promise<void> {
    try {
      await this.cacheManager.set(key, value, ttlMs);
    } catch (error) {
      this.logger.error(`Redis Set Error for key ${key}`, error);
      // Fallback: silently fail if cache fails to write
    }
  }

  async invalidateDashboard(tenantId: string): Promise<void> {
    this.logger.log(`Invalidating Dashboard Cache for Tenant: ${tenantId}`);
    try {
      // In a real Redis cluster, we might use SCAN or DEL if keys are known.
      // For now, we clear the known keys used by Dashboard
      await this.cacheManager.del(`dashboard:summary:${tenantId}`);
      await this.cacheManager.del(`dashboard:charts:${tenantId}`);
    } catch (error) {
      this.logger.error(`Failed to invalidate dashboard cache for ${tenantId}`, error);
    }
  }

  async invalidateFinance(tenantId: string): Promise<void> {
    this.logger.log(`Invalidating Finance Cache for Tenant: ${tenantId}`);
    try {
      await this.cacheManager.del(`analytics:finance:${tenantId}`);
      await this.cacheManager.del(`analytics:revenue:${tenantId}`);
    } catch (error) {
      this.logger.error(`Failed to invalidate finance cache for ${tenantId}`, error);
    }
  }

  async invalidateAnalyticsByKey(key: string): Promise<void> {
    try {
      await this.cacheManager.del(key);
    } catch (error) {
      this.logger.error(`Failed to invalidate cache key ${key}`, error);
    }
  }
}
