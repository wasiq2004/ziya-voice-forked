const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
    const connection = await mysql.createConnection({
        host: process.env.MYSQL_HOST || 'localhost',
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD || '',
        database: process.env.MYSQL_DATABASE || 'ziya_voice_agent'
    });

    console.log('Connected to database for manual migration...');

    try {
        const checkColumn = async (table, column) => {
            const [rows] = await connection.execute(
                `SHOW COLUMNS FROM ${table} LIKE '${column}'`
            );
            return rows.length > 0;
        };

        const queries = [];

        // campaigns table updates
        if (!(await checkColumn('campaigns', 'agent_id')))
            queries.push("ALTER TABLE campaigns ADD COLUMN agent_id VARCHAR(50) NULL");
        if (!(await checkColumn('campaigns', 'phone_number_id')))
            queries.push("ALTER TABLE campaigns ADD COLUMN phone_number_id VARCHAR(50) NULL");
        if (!(await checkColumn('campaigns', 'concurrent_calls')))
            queries.push("ALTER TABLE campaigns ADD COLUMN concurrent_calls INT DEFAULT 1");
        if (!(await checkColumn('campaigns', 'max_retry_attempts')))
            queries.push("ALTER TABLE campaigns ADD COLUMN max_retry_attempts INT DEFAULT 0");

        // campaign_contacts table updates
        if (!(await checkColumn('campaign_contacts', 'email')))
            queries.push("ALTER TABLE campaign_contacts ADD COLUMN email VARCHAR(255) NULL AFTER name");
        if (!(await checkColumn('campaign_contacts', 'intent')))
            queries.push("ALTER TABLE campaign_contacts ADD COLUMN intent VARCHAR(100) NULL AFTER status");
        if (!(await checkColumn('campaign_contacts', 'schedule_time')))
            queries.push("ALTER TABLE campaign_contacts ADD COLUMN schedule_time DATETIME NULL AFTER intent");
        if (!(await checkColumn('campaign_contacts', 'transcript')))
            queries.push("ALTER TABLE campaign_contacts ADD COLUMN transcript TEXT NULL AFTER schedule_time");
        if (!(await checkColumn('campaign_contacts', 'call_duration')))
            queries.push("ALTER TABLE campaign_contacts ADD COLUMN call_duration INT DEFAULT 0 AFTER transcript");
        if (!(await checkColumn('campaign_contacts', 'call_cost')))
            queries.push("ALTER TABLE campaign_contacts ADD COLUMN call_cost DECIMAL(10, 4) DEFAULT 0.0000 AFTER call_duration");

        if (queries.length === 0) {
            console.log('✅ No migration needed. All columns exist.');
        } else {
            for (const query of queries) {
                console.log(`Running: ${query}`);
                await connection.execute(query);
            }
            console.log('✅ Migration successful!');
        }

    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await connection.end();
    }
}

migrate();
