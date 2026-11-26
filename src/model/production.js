'use strict';
// 把开采、加工和机器建造放进同一步，统一分配原料和电力。
const Production = (() => {
  const remainder = (stock, used) => {
    const left = Math.max(0, stock - used);
    return left <= Math.max(Number.MIN_VALUE, stock * Number.EPSILON * 8) ? 0 : left;
  };

  function distribute(mass, allocation, limits = {}) {
    const amounts = Object.fromEntries(Object.keys(allocation).map(key => [key, 0]));
    let left = mass;
    for (let iteration = 0; iteration <= Object.keys(allocation).length && left > 0; iteration++) {
      const keys = Object.keys(allocation).filter(key => allocation[key] > 0 && (limits[key] ?? Infinity) > amounts[key]);
      const weight = keys.reduce((total, key) => total + allocation[key], 0);
      if (!weight) break;
      let part = left;
      for (const key of keys) part = Math.min(part, ((limits[key] ?? Infinity) - amounts[key]) * weight / allocation[key]);
      if (!(part > 0)) break;
      let used = 0;
      for (let index = 0; index < keys.length; index++) {
        const key = keys[index], remaining = Math.max(0, part - used);
        const share = index === keys.length - 1 ? remaining : part * allocation[key] / weight;
        const amount = Math.min((limits[key] ?? Infinity) - amounts[key], remaining, share);
        amounts[key] += amount;
        used += amount;
      }
      if (!(used > 0)) break;
      left = remainder(left, used);
    }
    return { amounts, mass: mass - left };
  }

  function batch({ allocation, limits = {}, recipe, extra = {}, stock = 0, mineEnergy = 0, mineLimit = 0, electricity, work, stopAt = [] }) {
    const output = Object.fromEntries(Object.keys(allocation).map(key => [key, 0]));
    let stored = stock, mining = mineLimit, energy = electricity, processing = work;
    let built = 0, mined = 0, stockUsed = 0, mineJ = 0, fabricationJ = 0, extraJ = 0;
    const finished = () => stopAt.length && stopAt.every(key => output[key] >= (limits[key] ?? Infinity));
    for (let iteration = 0; iteration < Object.keys(allocation).length + 2 && energy > 0 && processing > 0 && !finished(); iteration++) {
      const keys = Object.keys(allocation).filter(key => allocation[key] > 0 && (limits[key] ?? Infinity) > output[key]);
      const total = keys.reduce((n, key) => n + allocation[key], 0);
      if (!total) break;
      const weights = Object.fromEntries(keys.map(key => [key, allocation[key] / total]));
      const fabrication = keys.reduce((n, key) => n + weights[key] * recipe[key], 0);
      const transport = keys.reduce((n, key) => n + weights[key] * (extra[key] || 0), 0);
      const fromStock = stored > 0, extraction = fromStock ? 0 : mineEnergy;
      if (!fromStock && !(mining > 0)) break;
      let mass = Math.min(fromStock ? stored : mining, energy / (fabrication + transport + extraction), processing / fabrication);
      for (const key of keys) mass = Math.min(mass, ((limits[key] ?? Infinity) - output[key]) / weights[key]);
      if (!(mass > 0) || !Number.isFinite(mass)) break;
      let used = 0, processed = 0, launched = 0;
      for (let index = 0; index < keys.length; index++) {
        const key = keys[index], remaining = Math.max(0, mass - used);
        const share = index === keys.length - 1 ? remaining : mass * weights[key];
        const amount = Math.min((limits[key] ?? Infinity) - output[key], remaining, share);
        output[key] += amount;
        used += amount;
        processed += amount * recipe[key];
        launched += amount * (extra[key] || 0);
      }
      if (!(used > 0)) break;
      const extracted = fromStock ? 0 : used * mineEnergy;
      if (fromStock) { stockUsed += used; stored = remainder(stored, used); }
      else { mined += used; mining = remainder(mining, used); }
      built += used;
      mineJ += extracted;
      fabricationJ += processed;
      extraJ += launched;
      energy = Math.max(0, energy - extracted - processed - launched);
      processing = Math.max(0, processing - processed);
    }
    return { output, built, mined, stockUsed, mineJ, fabricationJ, extraJ, electricity: energy, work: processing };
  }
  return { remainder, distribute, batch };
})();
