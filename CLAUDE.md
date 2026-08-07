## Bug verification standard
This app has a recurring bug pattern: an aggregate/total calculation works
correctly while a related breakdown (by category, by property, by date
range, by status) of the same underlying data is broken — often because
the breakdown uses separate, drifted query logic instead of the same
source. When fixing any bug involving totals, sums, or counts, always
also check and test the breakdowns of that same data before considering
the fix complete.
