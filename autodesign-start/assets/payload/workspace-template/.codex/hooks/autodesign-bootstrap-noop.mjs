#!/usr/bin/env node
import { pathToFileURL } from "node:url";

export const hookMetadata = {
  schemaVersion: 1,
  stage: "03-bootstrap-runtime",
  hook: "autodesign-bootstrap-noop",
  behavior: "noop"
};

export function handleAutodesignHook() {
  return hookMetadata;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.env.AUTODESIGN_HOOK_DEBUG === "1") {
    process.stdout.write(`${JSON.stringify(handleAutodesignHook(), null, 2)}\n`);
  }
}

export default handleAutodesignHook;
