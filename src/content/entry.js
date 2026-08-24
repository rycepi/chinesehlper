// Ensure process.env exists before loading the React bundle (avoids runtime errors in content scripts).
const g = globalThis;
if (!g.process) {
  g.process = { env: { NODE_ENV: "production" } };
} else if (!g.process.env) {
  g.process.env = { NODE_ENV: "production" };
} else if (!g.process.env.NODE_ENV) {
  g.process.env.NODE_ENV = "production";
}

import("./main.jsx");