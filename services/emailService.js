/**
 * Email Service
 * Handles email notifications using Resend
 */

const { Resend } = require('resend');
const { supabase } = require('../config/supabase');
require('dotenv').config();

// Enable email service when configured
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

class EmailService {
  constructor() {
    this.fromEmail = process.env.FROM_EMAIL || 'noreply@salesresolve.ro';
    this.adminEmail = process.env.ADMIN_EMAIL || 'romanetflavia@gmail.com';
  }

  /**
   * Send email notification
   */
  async sendEmail(to, subject, html, text = null) {
    try {
      if (!resend || !process.env.RESEND_API_KEY) {
        console.log('📧 Email service not configured. Skipping email send.');
        console.log('📝 To enable emails, configure: RESEND_API_KEY');
        return { success: false, error: 'Email service not configured' };
      }

      const emailData = {
        from: this.fromEmail,
        to: [to],
        subject,
        html,
        ...(text && { text })
      };

      const result = await resend.emails.send(emailData);
      
      // Log email to database
      await this.logEmail(to, subject, html, 'sent');
      
      console.log('📧 Email sent successfully:', result);
      return { success: true, data: result };
    } catch (error) {
      console.error('❌ Email send failed:', error);
      
      // Log failed email to database
      await this.logEmail(to, subject, html, 'failed');
      
      return { success: false, error: error.message };
    }
  }

  /**
   * Send new message notification to admin
   */
  async sendNewMessageNotification(messageData) {
    const { name, email, message } = messageData;
    
    const subject = `📨 Mesaj nou de la ${name} - Sales Resolve`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #333; color: white; padding: 20px; text-align: center;">
          <h1>📨 Mesaj nou - Sales Resolve</h1>
        </div>
        
        <div style="padding: 20px; background: #f9f9f9;">
          <h2>Detalii mesaj:</h2>
          
          <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <p><strong>👤 Nume:</strong> ${name}</p>
            <p><strong>📧 Email:</strong> ${email}</p>
            <p><strong>📅 Data:</strong> ${new Date().toLocaleString('ro-RO')}</p>
          </div>
          
          <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <h3>💬 Mesaj:</h3>
            <p style="line-height: 1.6;">${message}</p>
          </div>
          
          <div style="text-align: center; margin: 20px 0;">
            <a href="https://salesresolvefrontend-6bgv.vercel.app" 
               style="background: #333; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              🔗 Vezi în Dashboard
            </a>
          </div>
        </div>
        
        <div style="background: #333; color: white; padding: 15px; text-align: center; font-size: 12px;">
          <p>© 2024 Sales Resolve. Toate drepturile rezervate.</p>
        </div>
      </div>
    `;

    return await this.sendEmail(this.adminEmail, subject, html);
  }

  /**
   * Send welcome email to new client
   */
  async sendWelcomeEmail(clientEmail, clientName) {
    const subject = `🎉 Bine ai venit la Sales Resolve, ${clientName}!`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #333; color: white; padding: 20px; text-align: center;">
          <h1>🎉 Bine ai venit la Sales Resolve!</h1>
        </div>
        
        <div style="padding: 20px; background: #f9f9f9;">
          <h2>Salut, ${clientName}!</h2>
          
          <p>Mulțumim că ai ales Sales Resolve pentru dezvoltarea afacerii tale online! 🚀</p>
          
          <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <h3>🎯 Ce urmează:</h3>
            <ul>
              <li>✅ Echipa noastră va analiza nevoile tale</li>
              <li>📞 Vei fi contactat în 24 de ore</li>
              <li>💡 Vom discuta strategia perfectă pentru afacerea ta</li>
              <li>🚀 Vom începe dezvoltarea proiectului</li>
            </ul>
          </div>
          
          <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <h3>📞 Contact:</h3>
            <p><strong>📧 Email:</strong> salesresolve1@gmail.com</p>
            <p><strong>📱 Telefon:</strong> 0771510039</p>
          </div>
          
          <div style="text-align: center; margin: 20px 0;">
            <a href="https://salesresolvefrontend-6bgv.vercel.app" 
               style="background: #333; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              🌐 Vezi Website-ul
            </a>
          </div>
        </div>
        
        <div style="background: #333; color: white; padding: 15px; text-align: center; font-size: 12px;">
          <p>© 2024 Sales Resolve. Toate drepturile rezervate.</p>
        </div>
      </div>
    `;

    return await this.sendEmail(clientEmail, subject, html);
  }

  /**
   * Send project update notification
   */
  async sendProjectUpdateEmail(clientEmail, clientName, projectName, updateMessage) {
    const subject = `📈 Actualizare proiect: ${projectName}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #333; color: white; padding: 20px; text-align: center;">
          <h1>📈 Actualizare Proiect</h1>
        </div>
        
        <div style="padding: 20px; background: #f9f9f9;">
          <h2>Salut, ${clientName}!</h2>
          
          <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <h3>📋 Proiect: ${projectName}</h3>
            <p style="line-height: 1.6;">${updateMessage}</p>
          </div>
          
          <div style="text-align: center; margin: 20px 0;">
            <a href="https://salesresolvefrontend-6bgv.vercel.app" 
               style="background: #333; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              🔗 Vezi Progresul
            </a>
          </div>
        </div>
        
        <div style="background: #333; color: white; padding: 15px; text-align: center; font-size: 12px;">
          <p>© 2024 Sales Resolve. Toate drepturile rezervate.</p>
        </div>
      </div>
    `;

    return await this.sendEmail(clientEmail, subject, html);
  }

  /**
   * Log email to database
   */
  async logEmail(to, subject, body, status) {
    try {
      const { error } = await supabase
        .from('email_notifications')
        .insert({
          to_email: to,
          subject,
          body,
          status,
          sent_at: status === 'sent' ? new Date().toISOString() : null
        });

      if (error) {
        console.error('❌ Failed to log email to database:', error);
      }
    } catch (error) {
      console.error('❌ Error logging email:', error);
    }
  }

  /**
   * Get email statistics
   */
  async getEmailStats() {
    try {
      const { data, error } = await supabase
        .from('email_notifications')
        .select('status, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const stats = {
        total: data.length,
        sent: data.filter(email => email.status === 'sent').length,
        failed: data.filter(email => email.status === 'failed').length,
        pending: data.filter(email => email.status === 'pending').length
      };

      return { success: true, data: stats };
    } catch (error) {
      console.error('❌ Error getting email stats:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new EmailService();
