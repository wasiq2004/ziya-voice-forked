const fs = require('fs');
let content = fs.readFileSync('server/services/walletService.js', 'utf8');

const oldCode = `      const wallet = await this.getOrCreateWallet(userId);
      // Convert INR to Credits (1 INR = 1 Credit)
      const creditsToAdd = inrToCredits(parseFloat(amountInr));
      const newBalance = parseFloat(wallet.balance) + creditsToAdd;`;

const newCode = `      const wallet = await this.getOrCreateWallet(userId);
      // Convert INR to Credits (1 INR = 1 Credit)
      const creditsToAdd = inrToCredits(parseFloat(amountInr));

      // Check if admin is an org_admin
      let isOrgAdmin = false;
      if (adminId) {
        const [userRows] = await this.mysqlPool.execute(
          'SELECT role FROM users WHERE id = ?',
          [adminId]
        );
        if (userRows.length > 0 && userRows[0].role === 'org_admin') {
          isOrgAdmin = true;
        }
      }

      // If org_admin, deduct from their wallet first
      if (isOrgAdmin) {
         try {
           await this.deductCredits(adminId, creditsToAdd, 'credit_transfer', \`Transfer to user \${userId}\`);
         } catch (e) {
           throw new Error('Insufficient organization credits: ' + e.message);
         }
      }

      const newBalance = parseFloat(wallet.balance) + creditsToAdd;`;

if (content.includes(oldCode)) {
  content = content.replace(oldCode, newCode);
  fs.writeFileSync('server/services/walletService.js', content);
  console.log('SUCCESS: Fixed wallet transfer logic!');
} else {
  console.log('Pattern not found. Trying regex or manual fix...');
}
