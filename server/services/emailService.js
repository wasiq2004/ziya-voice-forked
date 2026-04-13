const nodemailer = require('nodemailer');
const ics = require('ics');

class EmailService {
    constructor() {
        // Automatically uses environment variables. If not set, logs dummy URLs instead.
        this.transporter = null;
        if (process.env.SMTP_HOST && process.env.SMTP_USER) {
            this.transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: process.env.SMTP_PORT || 587,
                secure: process.env.SMTP_PORT == 465,
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS
                }
            });
        }
    }

    async sendMeetingInvite(toEmail, customerName, agentName, scheduleDateISO, meetLink) {
        if (!toEmail) return false;

        console.log(`📧 Sending automated meeting invite to ${toEmail}`);

        const date = new Date(scheduleDateISO);

        const adminEmail = 'ziyasuite@gmail.com';

        // Prepare calendar ICS data
        const event = {
            start: [date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes()],
            duration: { minutes: 30 },
            title: `Scheduled Meeting with ${agentName || 'Ziya Voice'}`,
            description: `Thank you for scheduling a meeting!\nJoin using the Google Meet link: ${meetLink}`,
            location: meetLink,
            url: meetLink,
            status: 'CONFIRMED',
            busyStatus: 'BUSY',
            organizer: { name: agentName || 'Ziya Voice', email: process.env.SMTP_USER || 'no-reply@ziyavoice.com' },
            attendees: [
                { name: customerName || 'Customer', email: toEmail, rsvp: true, partstat: 'ACCEPTED', role: 'REQ-PARTICIPANT' },
                { name: 'Admin', email: adminEmail, rsvp: true, partstat: 'ACCEPTED', role: 'REQ-PARTICIPANT' }
            ]
        };

        const { error, value } = ics.createEvent(event);
        if (error) {
            console.error('❌ Failed to generate ICS file:', error);
            return false;
        }

        const mailOptions = {
            from: `"Ziya Voice Agent" <${process.env.SMTP_USER || 'no-reply@ziyavoice.com'}>`,
            to: toEmail,
            cc: adminEmail,
            subject: `Calendar Invite: Meeting with ${agentName || 'Ziya'}`,
            text: `Hi ${customerName || 'there'},\n\nYour meeting is scheduled at ${date.toLocaleString()}.\n\nJoin link: ${meetLink}\n\nWe have attached a calendar invite for your convenience.\n\nBest,\nZiya Voice Team`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
                    <h2>Meeting Scheduled!</h2>
                    <p>Hi ${customerName || 'there'},</p>
                    <p>Your meeting with <strong>${agentName || 'Ziya Voice Agent'}</strong> has been successfully booked.</p>
                    <p><strong>Date & Time:</strong> ${date.toLocaleString()}</p>
                    <div style="margin: 24px 0;">
                        <a href="${meetLink}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                            Join Google Meet
                        </a>
                    </div>
                    <p style="font-size: 14px; color: #666;">If the button doesn't work, copy and paste this link into your browser: <br/><a href="${meetLink}">${meetLink}</a></p>
                    <p>A calendar invite (.ics) has been attached to this email.</p>
                </div>
            `,
            icalEvent: {
                filename: 'invite.ics',
                method: 'request',
                content: value
            }
        };

        if (this.transporter) {
            try {
                const info = await this.transporter.sendMail(mailOptions);
                console.log(`✅ Meeting invite email sent to ${toEmail} | Message ID: ${info.messageId}`);
                return true;
            } catch (err) {
                console.error(`❌ Failed to send SMTP email to ${toEmail}:`, err);
                return false;
            }
        } else {
            console.log(`⚠️ SMTP block missing in .env. Falling back to ethereal/test mode...`);
            // Create a test ethereal account quickly
            try {
                const testAccount = await nodemailer.createTestAccount();
                const testTransporter = nodemailer.createTransport({
                    host: "smtp.ethereal.email",
                    port: 587,
                    secure: false,
                    auth: {
                        user: testAccount.user,
                        pass: testAccount.pass,
                    },
                });

                // Override from email
                mailOptions.from = testAccount.user;
                const info = await testTransporter.sendMail(mailOptions);
                console.log(`✅ TEST Email sent to ${toEmail}`);
                console.log(`🔗 Preview your sent email here: ${nodemailer.getTestMessageUrl(info)}`);
                return true;
            } catch (err) {
                console.error('❌ Failed to use Ethereal mock email:', err);
                return false;
            }
        }
    }

    async sendPasswordResetOtp(toEmail, otp, expiresInMinutes = 10) {
        if (!toEmail || !otp) return false;

        const mailOptions = {
            from: `"Ziya Voice Agent" <${process.env.SMTP_USER || 'no-reply@ziyavoice.com'}>`,
            to: toEmail,
            subject: 'Your Ziya Voice password reset OTP',
            text: `Your password reset OTP is ${otp}. It expires in ${expiresInMinutes} minutes. If you did not request this, you can ignore this email.`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
                    <h2>Password Reset Request</h2>
                    <p>Use the OTP below to reset your Ziya Voice password:</p>
                    <div style="margin: 24px 0; padding: 16px; background: #f3f4f6; border-radius: 8px; text-align: center;">
                        <span style="font-size: 32px; letter-spacing: 8px; font-weight: bold; color: #111827;">${otp}</span>
                    </div>
                    <p>This OTP expires in <strong>${expiresInMinutes} minutes</strong>.</p>
                    <p style="font-size: 14px; color: #666;">If you did not request a password reset, you can safely ignore this email.</p>
                </div>
            `
        };

        if (this.transporter) {
            try {
                const info = await this.transporter.sendMail(mailOptions);
                console.log(`Password reset OTP email sent to ${toEmail} | Message ID: ${info.messageId}`);
                return true;
            } catch (err) {
                console.error(`Failed to send password reset OTP to ${toEmail}:`, err);
                return false;
            }
        }

        console.log('SMTP block missing in .env. Falling back to ethereal/test mode for password reset email...');
        try {
            const testAccount = await nodemailer.createTestAccount();
            const testTransporter = nodemailer.createTransport({
                host: 'smtp.ethereal.email',
                port: 587,
                secure: false,
                auth: {
                    user: testAccount.user,
                    pass: testAccount.pass,
                },
            });

            mailOptions.from = testAccount.user;
            const info = await testTransporter.sendMail(mailOptions);
            console.log(`TEST password reset email sent to ${toEmail}`);
            console.log(`Preview your sent email here: ${nodemailer.getTestMessageUrl(info)}`);
            return true;
        } catch (err) {
            console.error('Failed to use Ethereal mock email for password reset:', err);
            return false;
        }
    }

    generateMeetLink() {
        const str = () => Math.random().toString(36).substring(2, 6);
        return `https://meet.google.com/ziya-${str()}-${str()}`;
    }
}

module.exports = new EmailService();
