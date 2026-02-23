const mysql = require('mysql2/promise');
const express = require('express');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(express.json());

let resolveWebhook;
const webhookPromise = new Promise(r => { resolveWebhook = r; });

app.post('/webhook', (req, res) => {
    console.log('\n--- WEBHOOK RECEIVED ---');
    console.log(JSON.stringify(req.body, null, 2));
    res.sendStatus(200);
    resolveWebhook();
});

const server = app.listen(9090, async () => {
    console.log('Webhook receiver running on port 9090...');

    try {
        const pool = mysql.createPool({ host: 'localhost', user: 'root', password: '1234', database: 'ziya_voice_agent' });

        // Create mock agent w/ webhook enabled
        const agentId = uuidv4();
        const settingsObj = { webhookEnabled: true, webhookUrl: 'http://localhost:9090/webhook' };
        const settingsStr = JSON.stringify(settingsObj);

        await pool.execute(
            `INSERT INTO agents (id, user_id, name, identity, status, model, voice_id, language, settings, created_at, voice_provider, voice_provider_voice_id) 
             VALUES (?, 1, 'Mock Webhook Agent', '', 'active', 'gpt-4', '', 'en', ?, NOW(), '', '')`,
            [agentId, settingsStr]
        );

        // Create mock campaign
        const campaignId = uuidv4();
        await pool.execute(
            `INSERT INTO campaigns (id, user_id, agent_id, name, status, concurrent_calls, max_retry_attempts, total_contacts, total_cost) 
             VALUES (?, 1, ?, 'Mock Webhook Campaign', 'running', 1, 0, 1, 0)`,
            [campaignId, agentId]
        );

        // Create mock contact
        const contactId = uuidv4();
        await pool.execute(
            `INSERT INTO campaign_contacts (id, campaign_id, phone_number, name, email, status) 
             VALUES (?, ?, '+123456789', 'John Doe', 'john@example.com', 'calling')`,
            [contactId, campaignId]
        );

        // Import and initialize CampaignService
        const CampaignService = require('./services/campaignService');
        const mockWallet = { checkBalanceForCall: async () => ({ allowed: true }) };

        // Override methods that aren't relevant to this test
        CampaignService.prototype.logToGoogleSheets = async () => { };
        CampaignService.prototype.completeCampaign = async () => { };

        const cs = new CampaignService(pool, mockWallet, {}, {});

        console.log('Completing call to trigger webhook...');
        await cs.handleCallCompletion(contactId, 'completed', 45, 0.05, 'https://storage.example.com/audio.mp3', 'Call went well', 'Interested', 'http://meet.google.com/xyz', '2026-03-01T10:00:00Z');

        await webhookPromise;
        console.log('Verification Complete.');

        // Cleanup DB
        await pool.execute('DELETE FROM campaign_contacts WHERE id = ?', [contactId]);
        await pool.execute('DELETE FROM campaigns WHERE id = ?', [campaignId]);
        await pool.execute('DELETE FROM agents WHERE id = ?', [agentId]);
        await pool.end();

    } catch (e) {
        console.error('Test Failed:', e);
    } finally {
        server.close();
        process.exit(0);
    }
});
