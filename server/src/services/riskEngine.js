/**
 * Monte Carlo PD simulator (toy but coherent):
 * - Monthly income ~ Normal(mean, stdev) truncated >=0
 * - Monthly baseline expenses ~ Normal(meanExp, stdevExp) truncated >=0
 * - Shock scenarios: job loss prob, emergency expense prob
 * - Default: if cash balance < 0 at any month or debt service ratio too high
 */

function randn() {
  // Box-Muller
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function clampMin(x, min) {
  return x < min ? min : x;
}

export function simulatePD({
  simulations = 5000,
  months = 6,
  startingCash = 500,
  monthlyIncomeMean = 3000,
  monthlyIncomeStdev = 600,
  monthlyExpenseMean = 2200,
  monthlyExpenseStdev = 400,
  jobLossProb = 0.04,          // per-month
  emergencyProb = 0.06,        // per-month
  emergencyCostMean = 900,
  emergencyCostStdev = 300,
  minCashBuffer = 0
}) {
  let defaults = 0;

  for (let s = 0; s < simulations; s++) {
    let cash = startingCash;
    let jobLost = false;

    for (let m = 0; m < months; m++) {
      // Job loss shock (once it happens, income drops hard)
      if (!jobLost && Math.random() < jobLossProb) jobLost = true;

      let income = clampMin(monthlyIncomeMean + monthlyIncomeStdev * randn(), 0);
      if (jobLost) income *= 0.2;

      let expense = clampMin(monthlyExpenseMean + monthlyExpenseStdev * randn(), 0);

      // Emergency shock
      if (Math.random() < emergencyProb) {
        const em = clampMin(emergencyCostMean + emergencyCostStdev * randn(), 0);
        expense += em;
      }

      cash += income - expense;

      if (cash < minCashBuffer) {
        defaults++;
        break;
      }
    }
  }

  const pd = defaults / simulations; // 0..1
  return { pd, defaults, simulations, months };
}

export function pdToCapsuleLimit({ approvedLimit, pd }) {
  // Simple monotonic sizing: higher PD => smaller capsule
  // You can justify this in interviews as “risk-based exposure management”.
  // PD buckets:
  // 0-5% => up to 80% of approved
  // 5-15% => up to 50%
  // 15-30% => up to 25%
  // >30% => up to 10%
  let factor = 0.8;
  if (pd > 0.05) factor = 0.5;
  if (pd > 0.15) factor = 0.25;
  if (pd > 0.30) factor = 0.10;

  const capsuleLimit = Math.max(50, Math.floor(approvedLimit * factor));
  return { capsuleLimit, factor };
}

export function computeRiskTier({ pd, deviceChanged, geoAnomaly, velocityScore }) {
  // Combined score 0..100
  const pdScore = Math.min(100, Math.round(pd * 200)); // PD 0.5 => 100
  const deviceScore = deviceChanged ? 20 : 0;
  const geoScore = geoAnomaly ? 20 : 0;
  const velScore = Math.min(30, Math.round(velocityScore));

  const total = pdScore + deviceScore + geoScore + velScore;

  let tier = "LOW";
  if (total >= 40) tier = "MEDIUM";
  if (total >= 70) tier = "HIGH";

  return { tier, score: total, breakdown: { pdScore, deviceScore, geoScore, velScore } };
}