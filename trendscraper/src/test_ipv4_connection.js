import pg from 'pg';
const { Client } = pg;

console.log('Testing PostgreSQL connection using 127.0.0.1 (IPv4)...\n');

const client = new Client({
    host: '127.0.0.1',
    port: 5432,
    database: 'viral_shorts',
    user: 'postgres',
    password: 'postgres',
});

try {
    console.log('Connecting with:');
    console.log('  host: 127.0.0.1');
    console.log('  port: 5432');
    console.log('  database: viral_shorts');
    console.log('  user: postgres');
    console.log('  password: postgres\n');

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
