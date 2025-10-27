/**
 * PluginConnector Interface
 * Defines the contract for all plugin integrations
 * @issue #9
 */

export interface PluginConnector {
  /** Unique identifier for the plugin */
  id: string;
  
  /** Human-readable plugin name */
  name: string;
  
  /** Plugin version */
  version: string;
  
  /** Initialize the plugin */
  initialize(): Promise<void>;
  
  /** Check if plugin is properly configured */
  isConfigured(): boolean;
  
  /** Export data to the external service */
  export(data: unknown): Promise<ExportResult>;
  
  /** Clean up resources */
  dispose(): Promise<void>;
}

export interface ExportResult {
  success: boolean;
  message?: string;
  externalUrl?: string;
}

// TODO: Add plugin lifecycle hooks
// TODO: Add error handling types
// TODO: Add authentication interfaces
