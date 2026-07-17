export function scoreTrainingResults() {
  const params = new URLSearchParams(location.search);

  return {
    total: params.get("total") ?? "0",
    average: params.get("average") ?? "0",
    visits: params.get("visits") ?? "0",
  };
}
