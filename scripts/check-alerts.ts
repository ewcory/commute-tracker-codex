import { runChecksForAllAlerts } from "@/lib/alertEngine";

async function main() {
  const results = await runChecksForAllAlerts(new Date());
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
