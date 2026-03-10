const mysql = require('mysql2/promise');
const crypto = require('crypto');
(async () => {
    try {
        const pool = mysql.createPool({
            host: 'localhost',
            port: 3306,
            user: 'root',
            password: '1234',
            database: 'ziya_voice_agent'
        });
        const [campaigns] = await pool.execute('SELECT id, user_id FROM campaigns LIMIT 1');
        if (campaigns.length > 0) {
            const camp = campaigns[0];
            const id = crypto.randomUUID();
            await pool.execute('INSERT INTO campaign_contacts (id, campaign_id, phone_number, name, email, status, intent, schedule_time, meet_link) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [
                id,
                camp.id,
                '+919876543210',
                'Demo Customer',
                'ziyasuite@gmail.com',
                'completed',
                'scheduled_meeting',
                new Date(Date.now() + 86400000),
                'https://meet.google.com/test-link-xyz'
            ]);
            console.log('Inserted dummy schedule data.');
        } else {
            console.log('No campaigns found to attach a contact to.');
        }
    } catch (e) {
        console.error(e);
    }
    process.exit();
})();
