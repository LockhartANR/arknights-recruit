let cachedOperators = null;
let cachedMap = null;

export function useOperators() {
  async function fetchOperators() {
    if (cachedOperators) return cachedOperators;
    const res = await fetch('/api/operators');
    const data = await res.json();
    cachedOperators = data;
    cachedMap = new Map(data.map(op => [op.id, op]));
    return data;
  }

  function getOperator(id) {
    return cachedMap?.get(id) || null;
  }

  function getOperators() {
    return cachedOperators || [];
  }

  return { fetchOperators, getOperator, getOperators };
}
