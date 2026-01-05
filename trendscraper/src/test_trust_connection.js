import pg from 'pg';
const { Client } = pg;

console.log('Testing PostgreSQL connection with TRUST auth...\n');

const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'viral_shorts',
    user: 'postgres',
    password: '', // Empty string for trust auth
});

try {
    console.log('Connecting with:');
    console.log('  host: localhost');
    console.log('  port: 5432');
    console.log('  database: viral_shorts');
    console.log('  user: postgres');
    console.log('  password: <none - using trust auth>\n');

    await client.connect();
    console.log('✅ Connection successful!');

    const result = await client.query('SELECT current_database(), current_user, version()');
    console.log('\nDatabase info:');
    console.log('  Database:', result.rows[0].current_database);
    console.log('  User:', result.rows[0].current_user);
    console.log('  Version:', result.rows[0].version);

    await client.end();
    process.exit(0);
} catch (error) {
    console.error('❌ Connection failed!');
    console.error('Error:', error.message);
    console.error('\nFull error:', error);
    await client.end().catch(() => {});
    process.exit(1);
}
