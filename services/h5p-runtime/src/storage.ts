import type { IKeyValueStorage } from "@lumieducation/h5p-server";

/**
 * Simple in-memory key-value storage for H5P runtime configuration and cache.
 * Persisting these values is not required for SPEC-005 playback semantics.
 */
export class InMemoryStorage implements IKeyValueStorage {
  private store = new Map<string, unknown>();

  async load(key: string): Promise<unknown> {
    return this.store.get(key);
  }

  async save(key: string, value: unknown): Promise<void> {
    this.store.set(key, value);
  }
}
