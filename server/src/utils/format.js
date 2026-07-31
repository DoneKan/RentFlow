function formatCurrency(amount, currency = 'UGX') {
  const num = typeof amount === 'object' ? Number(amount) : Number(amount);
  return `${currency} ${num.toLocaleString('en-UG', { minimumFractionDigits: 0 })}`;
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-UG', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

module.exports = { formatCurrency, formatDate };
