const cron = require('node-cron');
const logger = require('../utils/logger');

const prisma = require('../utils/prisma');

const STAFF_ROLES = ['SUPER_ADMIN', 'ADMIN', 'PROPERTY_MANAGER', 'LANDLORD'];

// Adds `months` to `anchorDate`, clamped to the last day of the target
// month when the anchor's day-of-month doesn't exist there (e.g. the 31st
// in a 30-day month, or Feb 29th-31st) — same principle as invoiceJob.js's
// addMonthsFromAnchor, and for the same reason: computed from a fixed
// anchor every time, never from a previously-computed occurrence, so a
// reminder anchored on the 31st doesn't permanently drift to the 3rd the
// first time it crosses a 28-day February.
function addMonthsClamped(anchorDate, months) {
  const day = anchorDate.getDate();
  const target = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + months, 1);
  const daysInTargetMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, daysInTargetMonth));
  return target;
}

function occurrenceAt(anchorDate, recurrenceType, customIntervalDays, periodsElapsed) {
  if (recurrenceType === 'MONTHLY') return addMonthsClamped(anchorDate, periodsElapsed);
  if (recurrenceType === 'ANNUAL') return addMonthsClamped(anchorDate, periodsElapsed * 12);
  const d = new Date(anchorDate);
  d.setDate(d.getDate() + periodsElapsed * (customIntervalDays || 30));
  return d;
}

// The smallest occurrence that is today or later — a forward-looking "when
// is this next due", not a backward-looking billing due date. Once an
// occurrence's date has fully passed, the very next run of this function
// naturally returns the following one instead, with no separate rollover
// step needed.
function nextOccurrenceOnOrAfter(anchorDate, recurrenceType, customIntervalDays, today) {
  let n = 0;
  while (occurrenceAt(anchorDate, recurrenceType, customIntervalDays, n) < today) {
    n++;
  }
  return occurrenceAt(anchorDate, recurrenceType, customIntervalDays, n);
}

function isSameDay(a, b) {
  return !!a && !!b && new Date(a).toDateString() === new Date(b).toDateString();
}

// Reminds the org's staff (via the in-app notification bell) that one of
// their own recurring costs — URA tax, council fees, askari wages, ... —
// is coming due. Deliberately separate from tenant invoicing: no invoice,
// no tenancy, nothing billed to anyone. SMS is the other intended channel
// per spec, but no SMS provider is wired up anywhere in this app yet — this
// is the hook point for it once one exists; today the in-app notification
// is the only channel that actually fires.
async function processLandlordExpenseReminders() {
  logger.info('[LandlordExpenseJob] Checking for expense reminders due...');
  const today = new Date();

  try {
    const reminders = await prisma.landlordExpenseReminder.findMany({ where: { isActive: true } });

    for (const reminder of reminders) {
      const currentDue = nextOccurrenceOnOrAfter(
        reminder.anchorDate, reminder.recurrenceType, reminder.customIntervalDays, today
      );

      let lastReminderForDueDate = reminder.lastReminderForDueDate;
      if (currentDue.getTime() !== new Date(reminder.nextDueDate).getTime()) {
        // The cycle has moved on to a new occurrence since we last looked
        // (the previous one's date has passed) — persist it and reset the
        // reminder-sent flag so the new occurrence gets its own reminder.
        lastReminderForDueDate = null;
        await prisma.landlordExpenseReminder.update({
          where: { id: reminder.id },
          data: { nextDueDate: currentDue, lastReminderForDueDate: null },
        });
      }

      const triggerDate = new Date(currentDue);
      triggerDate.setDate(triggerDate.getDate() - reminder.remindDaysBefore);

      const alreadyReminded = isSameDay(lastReminderForDueDate, currentDue);
      if (alreadyReminded || today < triggerDate) continue;

      const recipients = await prisma.user.findMany({
        where: { organizationId: reminder.organizationId, role: { in: STAFF_ROLES } },
        select: { id: true },
      });

      if (recipients.length > 0) {
        const dueDateLabel = currentDue.toISOString().slice(0, 10);
        await prisma.notification.createMany({
          data: recipients.map((u) => ({
            userId: u.id,
            type: 'LANDLORD_EXPENSE_DUE',
            title: `${reminder.name} due ${dueDateLabel}`,
            message: `${reminder.name} (${Number(reminder.amount).toLocaleString()}) is due on ${dueDateLabel}.`,
            data: JSON.stringify({ landlordExpenseReminderId: reminder.id }),
          })),
        });
        logger.info(`[LandlordExpenseJob] Reminded ${recipients.length} user(s) about "${reminder.name}" due ${dueDateLabel}`);
      }

      await prisma.landlordExpenseReminder.update({
        where: { id: reminder.id },
        data: { lastReminderForDueDate: currentDue },
      });
    }

    logger.info('[LandlordExpenseJob] Expense reminder check complete');
  } catch (err) {
    logger.error('[LandlordExpenseJob] Expense reminder check failed:', err);
  }
}

function initializeJobs() {
  // Daily at 6:30 AM EAT — same general morning batch as the invoice jobs.
  cron.schedule('30 6 * * *', processLandlordExpenseReminders, { timezone: 'Africa/Nairobi' });
  logger.info('[LandlordExpenseJob] Cron job initialized (expense reminders @ 6:30 AM EAT)');
}

module.exports = { initializeJobs, processLandlordExpenseReminders };
