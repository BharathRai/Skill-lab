const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const { Parser } = require('json2csv');

const app = express();
app.use(bodyParser.json());
const PORT = 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

let paymentQueue = [];
let priorityQueue = [];
let transactionStack = [];

const ensureDirectory = (path) => {
  if (!fs.existsSync(path)) {
    fs.mkdirSync(path, { recursive: true });
  }
};
ensureDirectory('./invoices');
ensureDirectory('./logs');

app.post('/pay-bill', (req, res) => {
    const { userId, amount, billType } = req.body;

    if (!userId || !amount || !billType) {
      return res.status(400).send('Invalid input');
    }

    const paymentRequest = { userId, amount, billType, timestamp: Date.now() };
    paymentQueue.push(paymentRequest);

    res.send(`Payment request added to the queue for user ${userId}`);
});

app.post('/urgent-request', (req, res) => {
  const { userId, amount, billType, urgencyType } = req.body;

  if (!userId || !amount || !billType || !urgencyType) {
    return res.status(400).send('Invalid input');
  }

  const urgentRequest = { userId, amount, billType, urgencyType, timestamp: Date.now() };
  priorityQueue.push(urgentRequest);

  res.send(`Urgent payment request added to the priority queue for user ${userId}`);
});

app.post('/process-queue', (req, res) => {
  let processedPayment = null;

  if (priorityQueue.length > 0) {
    processedPayment = priorityQueue.shift();
  } else if (paymentQueue.length > 0) {
    processedPayment = paymentQueue.shift();
  } else {
    return res.send("No payment requests to process.");
  }

  transactionStack.push(processedPayment);
  generateInvoice(processedPayment);

  res.send(`Processed payment for user ${processedPayment.userId} and generated invoice.`);
});

app.get('/view-transactions', (req, res) => {
  res.json(transactionStack);
});

app.post('/undo-payment', (req, res) => {
  if (transactionStack.length === 0) {
    return res.send("No transactions to undo.");
  }

  const undoneTransaction = transactionStack.pop();
  res.send(`Undid last payment for user ${undoneTransaction.userId}`);
});

const generateInvoice = (payment) => {
  const doc = new PDFDocument();
  const filePath = `./invoices/${payment.userId}_${payment.timestamp}.pdf`;

  doc.pipe(fs.createWriteStream(filePath));
  doc.fontSize(20).text('Invoice for Bill Payment', { align: 'center' });
  doc.moveDown();
  doc.fontSize(14).text(`User  ID: ${payment.userId}`);
  doc.text(`Bill Type: ${payment.billType}`);
  doc.text(`Amount Paid: $${payment.amount}`);
  doc.text(`Date: ${new Date(payment.timestamp).toLocaleString()}`);
  
  doc.end();
};

const logTransactions = () => {
  const json2csvParser = new Parser();
  const csv = json2csvParser.parse(transactionStack);
  fs.writeFileSync('./logs/daily_transactions.csv', csv);
};

setInterval(logTransactions, 24 * 60 * 60 * 1000);