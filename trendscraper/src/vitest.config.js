import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['**/__tests__/**/*.test.js', '**/*.test.js'],
        exclude: ['node_modules', 'dist'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            exclude: ['node_modules', '__tests__', '*.config.js']
        },
        testTimeout: 30000, // 30 seconds for async tests
    }
});
