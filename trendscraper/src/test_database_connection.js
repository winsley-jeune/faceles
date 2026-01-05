/**
 * Database Connection Diagnostic
 * Identifies why the multi-tenant tests are failing
 */

console.log('🔍 Database Connection Diagnostic\n');
console.log('='.repeat(60));

// Step 1: Check environment variables
console.log('\n📋 Step 1: Environment Variables');
console.log('-'.repeat(60));
console.log(`USE_DATABASE: ${process.env.USE_DATABASE}`);
console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? '[SET]' : '[NOT SET]'}`);
console.log(`NODE_ENV: ${process.env.NODE_ENV || 'development'}`);

// Step 2: Try to import dataService
console.log('\n📋 Step 2: Import DataService');
console.log('-'.repeat(60));
try {
    const dataService = await import('./services/dataService.js');
    console.log('✅ DataService imported successfully');
    console.log(`DataService.tokens exists: ${!!dataService.default?.tokens}`);

    if (dataService.default?.tokens) {
        console.log('Available methods:', Object.keys(dataService.default.tokens));
    }
} catch (error) {
    console.error('❌ Failed to import DataService:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
}

// Step 3: Try to connect to database
console.log('\n📋 Step 3: Database Connection');
console.log('-'.repeat(60));
try {
    const { pool } = await import('./database/index.js');

    if (!pool) {
        console.log('⚠️ Database pool not initialized (USE_DATABASE might be false)');
    } else {
        const result = await pool.query('SELECT NOW()');
        console.log('✅ Database connection successful');
        console.log(`Current time from DB: ${result.rows[0].now}`);
    }
} catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('Details:', error);
}

// Step 4: Check if platform_tokens table exists
console.log('\n📋 Step 4: Check platform_tokens Table');
console.log('-'.repeat(60));
try {
    const { pool } = await import('./database/index.js');

    if (pool) {
        const result = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_name = 'platform_tokens'
            );
        `);

        if (result.rows[0].exists) {
            console.log('✅ platform_tokens table exists');

            // Get table structure
            const columns = await pool.query(`
                SELECT column_name, data_type
                FROM information_schema.columns
                WHERE table_name = 'platform_tokens'
                ORDER BY ordinal_position;
            `);

            console.log('\nTable structure:');
            columns.rows.forEach(col => {
                console.log(`  - ${col.column_name}: ${col.data_type}`);
            });
        } else {
            console.log('❌ platform_tokens table does NOT exist');
            console.log('\nYou need to create it using:');
            console.log('  docker-compose exec postgres psql -U postgres -d viral_shorts -f /docker-entrypoint-initdb.d/01-schema.sql');
        }
    }
} catch (error) {
    console.error('❌ Failed to check table:', error.message);
}

// Step 5: Summary and recommendations
console.log('\n' + '='.repeat(60));
console.log('📊 DIAGNOSTIC SUMMARY');
console.log('='.repeat(60));

const issues = [];

if (process.env.USE_DATABASE !== 'true') {
    issues.push('Set USE_DATABASE=true in your .env file');
}

if (!process.env.DATABASE_URL) {
    issues.push('Set DATABASE_URL in your .env file');
}

if (issues.length > 0) {
    console.log('\n❌ Issues Found:');
    issues.forEach((issue, i) => {
        console.log(`${i + 1}. ${issue}`);
    });

    console.log('\n📝 Recommended Actions:');
    console.log('1. Check trendscraper/src/.env file');
    console.log('2. Ensure USE_DATABASE=true');
    console.log('3. Ensure DATABASE_URL is set correctly');
    console.log('4. Run: docker-compose up -d postgres');
    console.log('5. Ensure schema is created (check Step 4 above)');
} else {
    console.log('\n✅ Configuration looks good!');
}

console.log('\n');
