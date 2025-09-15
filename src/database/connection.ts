import knex from 'knex';
import { config } from '../config';
import { User, AuditLog, RateLimit } from '../types';

const db = knex({
  client: 'mysql2',
  connection: config.database.url,
  pool: config.database.pool
});

export default db;

// Database models
export class UserModel {
  static async create(userData: Omit<User, 'created_at' | 'updated_at'>): Promise<User> {
    const insertData = {
      ...userData,
      created_at: new Date(),
      updated_at: new Date()
    };
    
    await db('users').insert(insertData);
    
    // Fetch the created user
    const user = await db('users').where('id', userData.id.toString()).first();
    return user;
  }

  static async findById(id: bigint): Promise<User | null> {
    const user = await db('users').where('id', id.toString()).first();
    return user || null;
  }

  static async findByGoogleEmail(email: string): Promise<User | null> {
    const user = await db('users').where('google_email', email).first();
    return user || null;
  }

  static async update(id: bigint, updates: Partial<User>): Promise<User | null> {
    const updateData = {
      ...updates,
      updated_at: new Date()
    };
    
    await db('users')
      .where('id', id.toString())
      .update(updateData);
    
    // Fetch the updated user
    const user = await db('users').where('id', id.toString()).first();
    return user || null;
  }

  static async delete(id: bigint): Promise<boolean> {
    const deleted = await db('users').where('id', id.toString()).del();
    return deleted > 0;
  }

  static async deactivate(id: bigint): Promise<boolean> {
    const updated = await db('users')
      .where('id', id.toString())
      .update({ is_active: false, updated_at: new Date() });
    return updated > 0;
  }
}

export class AuditLogModel {
  static async create(logData: Omit<AuditLog, 'id' | 'created_at'>): Promise<AuditLog> {
    const insertData = {
      ...logData,
      created_at: new Date()
    };
    
    const [insertId] = await db('audit_logs').insert(insertData);
    
    // Fetch the created log
    const log = await db('audit_logs').where('id', insertId).first();
    return log;
  }

  static async findByUserId(userId: bigint, limit = 100): Promise<AuditLog[]> {
    return db('audit_logs')
      .where('user_id', userId.toString())
      .orderBy('created_at', 'desc')
      .limit(limit);
  }

  static async findByAction(action: string, limit = 100): Promise<AuditLog[]> {
    return db('audit_logs')
      .where('action', action)
      .orderBy('created_at', 'desc')
      .limit(limit);
  }

  static async getFailedActions(userId: bigint, hours = 24): Promise<AuditLog[]> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    return db('audit_logs')
      .where('user_id', userId.toString())
      .where('success', false)
      .where('created_at', '>=', since)
      .orderBy('created_at', 'desc');
  }
}

export class RateLimitModel {
  static async get(userId: bigint, command: string): Promise<RateLimit | null> {
    const rateLimit = await db('rate_limits')
      .where('user_id', userId.toString())
      .where('command', command)
      .first();
    return rateLimit || null;
  }

  static async increment(userId: bigint, command: string): Promise<RateLimit> {
    const [rateLimit] = await db('rate_limits')
      .insert({
        user_id: userId.toString(),
        command,
        count: 1,
        window_start: new Date()
      })
      .onConflict(['user_id', 'command'])
      .merge({
        count: db.raw('"rate_limits"."count" + 1')
      })
      .returning('*');
    return rateLimit;
  }

  static async reset(userId: bigint, command: string): Promise<boolean> {
    const updated = await db('rate_limits')
      .where('user_id', userId.toString())
      .where('command', command)
      .update({
        count: 1,
        window_start: new Date()
      });
    return updated > 0;
  }

  static async cleanup(olderThan: Date): Promise<number> {
    return db('rate_limits')
      .where('window_start', '<', olderThan)
      .del();
  }
}
