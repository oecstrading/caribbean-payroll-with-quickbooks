// A random, permanent ID for this phone/browser. The server locks each employee's
// personal PIN clock to the first phone that uses it, so a PIN shared with a
// co-worker cannot be used from another phone (anti buddy-punching).
const KEY = "staff-clock-device-id";
export function clockDeviceId(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (!id || !/^[0-9a-f-]{36}$/.test(id)) { id = crypto.randomUUID(); localStorage.setItem(KEY, id); }
    return id;
  } catch { return crypto.randomUUID(); }
}
