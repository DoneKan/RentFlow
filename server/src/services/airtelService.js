const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

const pendingTransactions = new Map();

async function initiatePayment({ amount, currency = 'UGX', mobileNumber, externalId, reference }) {
  const transactionId = uuidv4();

  logger.info(`Airtel Money: Initiating payment of ${currency} ${amount} from ${mobileNumber} [txn: ${transactionId}]`);

  setTimeout(() => {
    pendingTransactions.set(transactionId, 'TS');
    logger.info(`Airtel Money: Payment ${transactionId} completed successfully (sandbox)`);
  }, 5000);

  pendingTransactions.set(transactionId, 'TIP');

  return {
    transactionId,
    status: 'TIP', // Transaction In Progress
    message: 'Payment initiated. Please approve on your Airtel mobile.',
  };
}

async function checkPaymentStatus(transactionId) {
  const status = pendingTransactions.get(transactionId) || 'TF'; // TF = Transaction Failed
  return { transactionId, status };
}

module.exports = { initiatePayment, checkPaymentStatus };
