import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Deploys the Blue Carbon Credit registry token.
 *
 * Override `vestingDuration` with Ignition deployment parameters for a
 * production interval; the 10-minute default is intentionally demo-friendly.
 */
const BlueCarbonCreditModule = buildModule("BlueCarbonCreditModule", (m) => {
  const vestingDuration = m.getParameter("vestingDuration", 600n);
  const blueCarbonCredit = m.contract("BlueCarbonCredit", [vestingDuration]);

  return { blueCarbonCredit };
});

export default BlueCarbonCreditModule;
