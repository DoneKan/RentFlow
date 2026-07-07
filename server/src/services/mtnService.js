const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

const pendingTransactions = new Map();

async function initiatePayment({ amount, currency = 'UGX', mobileNumber, externalId, payerMessage, payeeNote }) {
  const transactionId = uuidv4();

  logger.info(`MTN MoMo: Initiating payment of ${currency} ${amount} from ${mobileNumber} [txn: ${transactionId}]`);

  // Simulate async payment completion after 5 seconds
  setTimeout(() => {
    pendingTransactions.set(transactionId, 'SUCCESSFUL');
    logger.info(`MTN MoMo: Payment ${transactionId} completed successfully (sandbox)`);
  }, 5000);

  pendingTransactions.set(transactionId, 'PENDING');

  return {
    transactionId,
    status: 'PENDING',
    message: 'Payment initiated. Please approve on your mobile phone.',
  };
}

async function checkPaymentStatus(transactionId) {
  const status = pendingTransactions.get(transactionId) || 'FAILED';
  return { transactionId, status };
}

module.exports = { initiatePayment, checkPaymentStatus };
