import { z } from 'zod';
export declare class SchemaValidator {
    private static schemaMap;
    /**
     * Validate a breadcrumb against its schema
     */
    static validate(breadcrumb: any): {
        success: boolean;
        data?: any;
        error?: string;
    };
    /**
     * Register a custom schema
     */
    static registerSchema(name: string, schema: z.ZodSchema): void;
    /**
     * Check if a schema is registered
     */
    static hasSchema(name: string): boolean;
    /**
     * Get all registered schema names
     */
    static getSchemaNames(): string[];
}
export declare function validateBreadcrumb(breadcrumb: any): boolean;
export declare function assertValidBreadcrumb(breadcrumb: any): void;
export declare function parseBreadcrumb<T>(breadcrumb: any): T;
//# sourceMappingURL=index.d.ts.map