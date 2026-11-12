// Next.js runs register() once when a server starts, before it handles any
// requests. Loading the passages here puts the documents' embeddings in memory
// up front, so the first question doesn't wait for them.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { passagesInfo } = await import("@/lib/copper/passages");
  const { count, model } = passagesInfo();
  console.info(`[passages] loaded ${count} passages (${model}) into memory`);
}
