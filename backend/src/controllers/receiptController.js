const PDFDocument = require('pdfkit');
const path = require('path');
const supabase = require('../utils/supabase');

/**
 * Generate a branded PDF receipt for a payment
 * GET /api/payments/:id/receipt
 */
exports.generateReceipt = async (req, res) => {
    const { id } = req.params;

    try {
        // Fetch payment details with customer info
        const { data: payment, error } = await supabase
            .from('payments')
            .select('*, customers(*)')
            .eq('tenant_id', req.tenant_id)
            .eq('id', id)
            .single();

        if (error || !payment) {
            return res.status(404).json({ error: 'Payment record not found.' });
        }

        const doc = new PDFDocument({ size: 'A5', margin: 30 });
        
        // Stream the PDF to the response
        res.setHeader('Content-Type', 'application/json'); // Fallback if error occurs
        res.setHeader('Content-Disposition', `attachment; filename=receipt_${payment.transaction_code || 'MANUAL'}.pdf`);
        doc.pipe(res);

        // Header Branding
        const logoPath = path.join(__dirname, '../../../frontend/public/logo.png');
        try {
            doc.image(logoPath, 340, 25, { width: 40 });
        } catch (e) {
            // No logo, skip
        }

        doc.fillColor('#059669')
           .fontSize(20)
           .text('MOVEC CONNECT', 30, 25, { weight: 'bold' });
        
        doc.fillColor('#64748b')
           .fontSize(8)
           .text('High-Fidelity ISP Management', 30, 48);

        doc.moveDown(2);

        // Receipt Label
        doc.fillColor('#1e293b')
           .fontSize(14)
           .text('OFFICIAL PAYMENT RECEIPT', { align: 'center' });
        
        doc.strokeColor('#e2e8f0')
           .lineWidth(1)
           .moveTo(30, 95)
           .lineTo(390, 95)
           .stroke();

        doc.moveDown(1.5);

        // Transaction Grid
        const startY = doc.y;
        doc.fontSize(9).fillColor('#64748b');
        doc.text('Customer Name:', 30, startY);
        doc.text('Account Number:', 30, startY + 18);
        doc.text('Payment Method:', 30, startY + 36);
        doc.text('Transaction Ref:', 30, startY + 54);
        doc.text('Date & Time:', 30, startY + 72);

        doc.fillColor('#1e293b').font('Helvetica-Bold');
        doc.text(payment.customers.full_name, 140, startY);
        doc.text(payment.customers.account_number, 140, startY + 18);
        doc.text(payment.method, 140, startY + 36);
        doc.text(payment.transaction_code || 'MANUAL_ENTRY', 140, startY + 54);
        doc.text(new Date(payment.paid_at).toLocaleString(), 140, startY + 72);

        doc.moveDown(3);

        // Amount Section
        doc.font('Helvetica');
        const amountY = doc.y;
        doc.rect(30, amountY, 360, 40).fill('#f8fafc');
        
        doc.fillColor('#1e293b')
           .fontSize(10)
           .text('TOTAL AMOUNT PAID', 45, amountY + 15);
        
        doc.fillColor('#059669')
           .fontSize(16)
           .font('Helvetica-Bold')
           .text(`KES ${parseFloat(payment.amount).toLocaleString()}`, 250, amountY + 12, { align: 'right', width: 130 });

        // Watermark "PAID"
        doc.save();
        doc.opacity(0.1);
        doc.fontSize(60);
        doc.fillColor('#059669');
        doc.rotate(-25, { origin: [210, 300] });
        doc.text('PAID', 150, 300);
        doc.restore();

        // Footer
        doc.fillColor('#94a3b8')
           .fontSize(8)
           .font('Helvetica')
           .text('Thank you for your business! For any issues, contact support@movec.co.ke', 30, 540, { align: 'center', width: 360 });

        doc.end();

    } catch (e) {
        console.error('[Receipt Error]', e.message);
        res.status(500).json({ error: 'Failed to generate receipt PDF.' });
    }
};
