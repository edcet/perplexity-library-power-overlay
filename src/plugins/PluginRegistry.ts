/**
 * PluginRegistry
 * Centralized management for plugin connectors
 * @issue #9
 */

import { PluginConnector } from './PluginConnector.interface';

class PluginRegistry {
  private plugins: Map<string, PluginConnector> = new Map();
  
  /**
   * Register a new plugin connector
   */
  register(plugin: PluginConnector): void {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Plugin ${plugin.id} is already registered`);
    }
    this.plugins.set(plugin.id, plugin);
  }
  
  /**
   * Unregister a plugin by ID
   */
  unregister(pluginId: string): void {
    this.plugins.delete(pluginId);
  }
  
  /**
   * Get a plugin by ID
   */
  get(pluginId: string): PluginConnector | undefined {
    return this.plugins.get(pluginId);
  }
  
  /**
   * Get all registered plugins
   */
  getAll(): PluginConnector[] {
    return Array.from(this.plugins.values());
  }
  
  /**
   * Initialize all registered plugins
   */
  async initializeAll(): Promise<void> {
    const promises = Array.from(this.plugins.values())
      .map(plugin => plugin.initialize());
    await Promise.all(promises);
  }
}

export const pluginRegistry = new PluginRegistry();
export default pluginRegistry;

// TODO: Add plugin lifecycle events
// TODO: Add plugin dependency resolution
// TODO: Add plugin configuration persistence
