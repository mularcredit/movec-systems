# MikroTik Router Setup Requirements

This document lists every configuration step that **must be completed on your MikroTik router**
before the Movec Connect platform can connect to it and provision customers.

---

## 1. Enable the RouterOS API Service

You must enable the API on the router. **API-SSL (port 8729) is strongly recommended** for
encrypted credential transport. Plaintext API (port 8728) should only be used on an isolated
local network.

### Via Winbox
`IP → Services → api-ssl → Enable`

### Via Terminal
```routeros
# Recommended: API-SSL (encrypted, port 8729)
/ip service enable api-ssl
/ip service set api-ssl port=8729

# Optional: plaintext API (port 8728) — local/dev only
/ip service enable api
/ip service set api port=8728
```

---

## 2. Create a Dedicated API User

Create a user with `full` group access. Do not use the `admin` account directly.

```routeros
/user add name=isp-api password=YourStrongPassword group=full comment="Movec Connect API"
```

> ⚠️ Use a strong, unique password. This credential is stored encrypted in the database.

---

## 3. Create PPP Profiles (REQUIRED for PPPoE provisioning)

The platform passes `package_name` directly as the RouterOS `profile` field.
**The profile with that exact name must already exist on the router.**

```routeros
# Example: for a package named "10Mbps Home" in your billing system
/ppp profile add name="10Mbps Home" rate-limit=10M/10M local-address=10.10.0.1 remote-address=pppoe-pool

# Example: for a package named "5Mbps Basic"
/ppp profile add name="5Mbps Basic" rate-limit=5M/5M local-address=10.10.0.1 remote-address=pppoe-pool
```

> ⚠️ The name must match **exactly** (case-sensitive) the `name` field of the package
> in your billing system's `packages` table.

### Verify profiles exist
```routeros
/ppp profile print
```

---

## 4. Create Hotspot User Profiles (REQUIRED for Hotspot provisioning)

Same rule applies: profile name must match the package name exactly.

```routeros
/ip hotspot user profile add name="10Mbps Hotspot" rate-limit=10M/10M
```

### Verify
```routeros
/ip hotspot user profile print
```

---

## 5. Create a DHCP Pool for PPPoE (if using dynamic IPs)

```routeros
/ip pool add name=pppoe-pool ranges=10.10.1.1-10.10.1.254
```

---

## 6. Firewall: Allow API Access from Backend Server

If the router has a firewall, allow inbound connections on the API port from the backend IP.

```routeros
# Replace BACKEND_IP with your server's IP (e.g., Fly.io egress IP or local machine IP)
/ip firewall filter add chain=input src-address=BACKEND_IP protocol=tcp dst-port=8729 action=accept comment="Movec Connect API-SSL"
```

---

## 7. Verify Connectivity Before Saving

Use the Test Connection feature in the Movec Connect UI (or via API):

```bash
curl -X POST http://localhost:3000/api/router/test \
  -H "Content-Type: application/json" \
  -d '{"ip":"192.168.88.1","port":8729,"username":"isp-api","password":"YourStrongPassword"}'
```

**Expected successful response:**
```json
{
  "success": true,
  "message": "Handshake verified.",
  "identity": "MyRouterName",
  "profiles_found": 3
}
```

---

## 8. Network Reachability Requirements

| Deployment scenario | Requirement |
|---|---|
| Backend running locally + router on same LAN | Use local IP (e.g., `192.168.88.1`) |
| Backend deployed to Fly.io + router has public IP | Use public IP; ensure port 8729 is open on router |
| Backend deployed to Fly.io + router has private IP | Establish a WireGuard tunnel first; use tunnel IP |

---

## Summary Checklist

- [ ] `/ip service api-ssl` is enabled on port 8729
- [ ] API user `isp-api` exists with `group=full`
- [ ] PPP profiles exist for every active package (names match exactly)
- [ ] Hotspot profiles exist for every hotspot package (if applicable)
- [ ] DHCP pool defined for PPPoE
- [ ] Firewall allows backend IP to reach port 8729
- [ ] `ENCRYPTION_KEY` set as 64-char hex string in `backend/.env`
- [ ] Test Connection returns `success: true` before saving router
