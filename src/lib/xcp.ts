import xmlrpc from "xmlrpc";
import fs from "fs";
import { db } from "./db";
import { getSettingsMap } from "./settings-cache";

export interface XCPConfig {
  host: string;
  user: string;
  pass: string;
}

/**
 * The CA certificate to trust for the XCP-ng host (used when the host has a
 * private or self-signed certificate, which is the XCP-ng default).
 *
 * Accepts EITHER the PEM contents themselves OR a path to a PEM file. The path
 * form matters in Docker: a multi-line PEM inside an .env value or a compose
 * `environment:` entry is awkward to write and easy to corrupt, whereas a file
 * can simply be mounted.
 *
 * Unlike XCP_REJECT_UNAUTHORIZED, an unreadable path is not fatal — we warn and
 * fall back to the system CA store.
 */
function loadCaCertificate(): string | undefined {
  const raw = process.env.XCP_CA_CERT;
  if (!raw) return undefined;

  // Inline PEM contents.
  if (raw.includes("-----BEGIN")) return raw;

  // Otherwise treat it as a filesystem path.
  try {
    return fs.readFileSync(raw, "utf8");
  } catch (err) {
    console.warn(
      `[xcp] XCP_CA_CERT is set to "${raw}", which is neither PEM contents nor a ` +
      `readable file (${(err as Error).message}). Falling back to the system CA store.`,
    );
    return undefined;
  }
}

const XAPI_CA_CERT = loadCaCertificate();

// Only the literal "false" disables verification, so a typo or an empty value
// keeps certificate validation ON.
const XAPI_REJECT_UNAUTHORIZED = process.env.XCP_REJECT_UNAUTHORIZED !== "false";

if (!XAPI_REJECT_UNAUTHORIZED) {
  console.warn(
    "[xcp] XCP_REJECT_UNAUTHORIZED=false — TLS certificates for the XCP-ng host " +
    "are NOT being verified. Prefer XCP_CA_CERT with the host's CA certificate.",
  );
}

function createSecureClient(config: { host: string; port: number; path: string }) {
  const opts: Record<string, unknown> = {
    host: config.host,
    port: config.port,
    path: config.path,
    rejectUnauthorized: XAPI_REJECT_UNAUTHORIZED,
  };
  if (XAPI_CA_CERT) {
    opts.ca = XAPI_CA_CERT;
  }
  return xmlrpc.createSecureClient(opts as any);
}

let cachedSession: { sid: string; expires: number } | null = null;
let cachedClient: { client: any; host: string; expires: number } | null = null;
const SESSION_TTL_MS = 5 * 60 * 1000;
const CLIENT_TTL_MS = 10 * 60 * 1000;

async function getOrCreateClient(host: string) {
  if (cachedClient && cachedClient.host === host && cachedClient.expires > Date.now()) {
    return cachedClient.client;
  }
  const client = createSecureClient({ host, port: 443, path: "/" });
  cachedClient = { client, host, expires: Date.now() + CLIENT_TTL_MS };
  return client;
}

export async function getXCPConfig(): Promise<XCPConfig | null> {
  const map = await getSettingsMap();

  const host = map.xcpng_host;
  const user = map.xcpng_username;
  const pass = map.xcpng_password;

  if (!host || !user || !pass) return null;

  return { host, user, pass };
}

export async function getXCPSession(): Promise<string> {
  if (cachedSession && cachedSession.expires > Date.now()) {
    return cachedSession.sid;
  }

  const config = await getXCPConfig();
  if (!config) throw new Error("XCP-ng host is not configured.");

  const client = await getOrCreateClient(config.host);

  return new Promise((resolve, reject) => {
    client.methodCall(
      "session.login_with_password",
      [config.user, config.pass, "1.0", "Lab44"],
      (err: any, sessionId: any) => {
        if (err) return reject(err);
        if (sessionId.Status !== "Success")
          return reject(
            new Error(`Login failed: ${sessionId.ErrorDescription}`)
          );
        cachedSession = { sid: sessionId.Value, expires: Date.now() + SESSION_TTL_MS };
        resolve(sessionId.Value);
      }
    );
  });
}

export async function logoutXCPSession(sessionId: string): Promise<void> {
  const config = await getXCPConfig();
  if (!config) return;

  const client = await getOrCreateClient(config.host);

  return new Promise((resolve, reject) => {
    client.methodCall("session.logout", [sessionId], (err: any, result: any) => {
      if (err) return reject(err);
      if (result.Status !== "Success") {
        return reject(new Error(`Logout failed: ${result.ErrorDescription}`));
      }
      cachedSession = null;
      resolve();
    });
  });
}

export async function getVMConsoleConnectionTarget(
  uuid: string
): Promise<{ sessionId: string; location: string }> {
  const vmRef = await callXAPI("VM.get_by_uuid", [uuid]);
  const consoles = await callXAPI("VM.get_consoles", [vmRef]);

  if (!Array.isArray(consoles) || consoles.length === 0) {
    throw new Error("No consoles found for this VM.");
  }

  let rfbConsole: string | null = null;
  for (const c of consoles) {
    const protocol = await callXAPI("console.get_protocol", [c]);
    if (protocol === "rfb") {
      rfbConsole = c;
      break;
    }
  }

  if (!rfbConsole) {
    throw new Error("No VNC (rfb) console found for this VM.");
  }

  const sessionId = await getXCPSession();
  let location = await callXAPI("console.get_location", [rfbConsole]);

  if (!location) {
    throw new Error("The VM console did not return a location.");
  }

  location += location.includes("?")
    ? `&session_id=${encodeURIComponent(sessionId)}`
    : `?session_id=${encodeURIComponent(sessionId)}`;

  return { sessionId, location };
}

export async function callXAPI(method: string, params: any[]): Promise<any> {
  const config = await getXCPConfig();
  if (!config) throw new Error("XCP-ng host is not configured.");

  const client = await getOrCreateClient(config.host);
  const sid = await getXCPSession();

  return new Promise((resolve, reject) => {
    client.methodCall(
      method,
      [sid, ...params],
      (err: any, result: any) => {
        if (err) {
          if (err.message && err.message.includes("SESSION_INVALID")) {
            cachedSession = null;
          }
          return reject(err);
        }
        if (result.Status !== "Success")
          return reject(
            new Error(`API Error (${method}): ${result.ErrorDescription}`)
          );

        resolve(result.Value);
      }
    );
  });
}

export async function destroyVM(vmUuid: string): Promise<void> {
  try {
    const vmRef = await callXAPI("VM.get_by_uuid", [vmUuid]);

    const powerState = await callXAPI("VM.get_power_state", [vmRef]);
    if (powerState !== "Halted") {
      try {
        await callXAPI("VM.hard_shutdown", [vmRef]);
      } catch (e) {
        console.log("Failed to hard shutdown VM before destroy", e);
      }
    }

    const vbds = await callXAPI("VM.get_VBDs", [vmRef]);
    const vbdOps = vbds.map(async (vbdRef: string) => {
      const type = await callXAPI("VBD.get_type", [vbdRef]);
      try { await callXAPI("VBD.unplug", [vbdRef]); } catch (e) { }

      const vdiRef = await callXAPI("VBD.get_VDI", [vbdRef]);
      if (type === "Disk" && vdiRef && vdiRef !== "OpaqueRef:NULL") {
        try { await callXAPI("VBD.destroy", [vbdRef]); } catch (e) { }
        try { await callXAPI("VDI.destroy", [vdiRef]); } catch (e) { }
      }
    });
    await Promise.all(vbdOps);

    await callXAPI("VM.destroy", [vmRef]);
  } catch (err) {
    console.error(`Failed to destroy VM ${vmUuid}:`, err);
    throw err;
  }
}

export async function getVMDomId(uuid: string): Promise<string> {
  const vmRef = await callXAPI("VM.get_by_uuid", [uuid]);
  const domid = await callXAPI("VM.get_domid", [vmRef]);
  return domid?.toString() ?? "-1";
}

export async function provisionVM(
  templateUuid: string,
  vmName: string
): Promise<{ uuid: string; name: string }> {
  try {
    const templateRef = await callXAPI("VM.get_by_uuid", [templateUuid]);
    const newVmRef = await callXAPI("VM.clone", [templateRef, vmName]);
    await callXAPI("VM.set_is_a_template", [newVmRef, false]);
    const newVmUuid = await callXAPI("VM.get_uuid", [newVmRef]);

    return { uuid: newVmUuid, name: vmName };
  } catch (err) {
    console.error("Provisioning failed:", err);
    throw err;
  }
}

export async function getVMPowerState(vmUuid: string): Promise<string> {
  try {
    const vmRef = await callXAPI("VM.get_by_uuid", [vmUuid]);
    const powerState = await callXAPI("VM.get_power_state", [vmRef]);
    return powerState;
  } catch (err) {
    console.error(`Failed to get power state for ${vmUuid}:`, err);
    return "Unknown";
  }
}

export async function getVMLogs(vmUuid: string): Promise<string[]> {
  try {
    const vmRef = await callXAPI("VM.get_by_uuid", [vmUuid]);
    const metrics = await callXAPI("VM.get_guest_metrics", [vmRef]);
    if (metrics && metrics !== "OpaqueRef:NULL") {
      const data = await callXAPI(
        "VM_guest_metrics.get_other_config",
        [metrics]
      );
      return Object.entries(data).map(([k, v]) => `${k}: ${v}`);
    }
    return ["No logs available yet. Guest agent might not be running."];
  } catch (err) {
    return [`Error fetching logs: ${err}`];
  }
}

export async function getVMIPAddress(vmUuid: string): Promise<string | null> {
  try {
    const vmRef = await callXAPI("VM.get_by_uuid", [vmUuid]);
    const metrics = await callXAPI("VM.get_guest_metrics", [vmRef]);

    if (metrics && metrics !== "OpaqueRef:NULL") {
      const networks = await callXAPI("VM_guest_metrics.get_networks", [
        metrics,
      ]);

      if (networks) {
        if (networks["0/ip"]) return networks["0/ip"];
        if (networks["0/ipv4/0"]) return networks["0/ipv4/0"];

        for (const key of Object.keys(networks)) {
          if (networks[key].match(/^\d+\.\d+\.\d+\.\d+$/)) {
            return networks[key];
          }
        }
      }
    }
  } catch (err) {
    console.error(`Failed to get IP address for ${vmUuid}:`, err);
  }
  return null;
}

export async function getAllVMs(): Promise<
  Array<{
    uuid: string;
    name: string;
    desc: string;
    power_state: string;
  }>
> {
  const vms = await callXAPI("VM.get_all_records", []);

  return Object.entries(vms)
    .filter(([, v]: [string, any]) => !v.is_a_template && !v.is_control_domain)
    .map(([ref, v]: [string, any]) => ({
      uuid: v.uuid,
      name: v.name_label,
      desc: v.name_description || "",
      power_state: v.power_state,
    }));
}

export async function getTemplates(): Promise<
  Array<{
    uuid: string;
    name: string;
    desc: string;
    power_state: string;
    VCPUs_max?: number;
    memory_static_max?: number;
  }>
> {
  const vms = await callXAPI("VM.get_all_records", []);

  return Object.entries(vms)
    .filter(
      ([, v]: [string, any]) => v.is_a_template && !v.is_a_snapshot
    )
    .map(([ref, v]: [string, any]) => ({
      uuid: v.uuid,
      name: v.name_label,
      desc: v.name_description || "",
      power_state: v.power_state,
      VCPUs_max: parseInt(v.VCPUs_max) || undefined,
      memory_static_max: parseInt(v.memory_static_max) || undefined,
    }));
}

export async function setVMResources(
  vmUuid: string,
  vcpus: number,
  memoryBytes: number
): Promise<void> {
  const vmRef = await callXAPI("VM.get_by_uuid", [vmUuid]);
  await callXAPI("VM.set_VCPUs_max", [vmRef, String(vcpus)]);
  await callXAPI("VM.set_VCPUs_at_startup", [vmRef, String(vcpus)]);
  await callXAPI("VM.set_platform", [vmRef, { "cores-per-socket": String(vcpus) }]);
  await callXAPI("VM.set_memory_limits", [
    vmRef,
    String(memoryBytes),
    String(memoryBytes),
    String(memoryBytes),
    String(memoryBytes),
  ]);
}

export async function getHostCapacity(): Promise<{ vcpus: number; ramGB: number }> {
  const hosts = await callXAPI("host.get_all", []);
  if (!Array.isArray(hosts) || hosts.length === 0) {
    return { vcpus: 0, ramGB: 0 };
  }
  const hostRef = hosts[0];
  const record = await callXAPI("host.get_record", [hostRef]);
  const cpuInfo = record.cpu_info || {};
  const cpuCount = parseInt(cpuInfo.cpu_count || '0') || 0;
  const ramBytes = parseInt(record.memory_total || '0') || 0;
  return { vcpus: cpuCount, ramGB: Math.round(ramBytes / (1024 * 1024 * 1024)) };
}
