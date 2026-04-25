# Movec Connect: Onsite Router Deployment Manual
**Version:** 2.1 (Production Ready)
**Author:** Movec Engineering
**Last Updated:** April 25, 2026

---

## Introduction
This manual outlines the standardized procedure for deploying a new MikroTik Router node into the Movec Connect ecosystem. Following these steps ensures secure management via the Dashboard and reliable RADIUS authentication for subscribers.

---

## Phase 1: Security Handshake (WireGuard VPN)
We use WireGuard to bypass CGNAT (like Starlink) and ensure a secure 256-bit encrypted link between the site and our DigitalOcean hub.

1. **Initialize WireGuard:**
   ```bash
   /interface wireguard add name=wg-movec listen-port=13231
   ```
2. **Retrieve your Public Key:**
   ```bash
   /interface wireguard print
   ```
   *Copy the `public-key` and send it to the Network Admin to authorize on the server.*

3. **Link to the Hub:**
   *(Replace `HUB_PUBLIC_KEY` with the current server key)*
   ```bash
   /interface wireguard peers add interface=wg-movec public-key="ndm4e1CXE3FybrILFj0L5STlJWUW32x61hO4gLSoxhk=" endpoint-address=157.230.96.39 endpoint-port=51820 allowed-address=0.0.0.0/0 persistent-keepalive=25
   ```

---

## Phase 2: Internal Networking
1. **Assign your Site ID (IP):**
   *Assign the next available IP in the 10.0.0.x range (e.g., .3, .4, .5).*
   ```bash
   /ip address add address=10.0.0.3/24 interface=wg-movec
   ```
2. **Test the Tunnel:**
   ```bash
   /ping 10.0.0.1 count=5
   ```
   *If this fails, do not proceed. Check Phase 1.*

---

## Phase 3: AAA & RADIUS Configuration
1. **Configure the RADIUS Client:**
   ```bash
   /radius add address=10.0.0.1 secret="Movec@HomeLab#2026!Ke" service=ppp src-address=10.0.0.3 timeout=3000ms
   ```
2. **Enable RADIUS for PPP:**
   ```bash
   /ppp aaa set use-radius=yes
   ```

---

## Phase 4: Service Deployment (PPPoE)
This is where customers actually connect.

1. **Configure the PPPoE Server:**
   **CRITICAL:** You must use **PAP** authentication only.
   ```bash
   /interface pppoe-server server set [find] authentication=pap use-radius=yes
   ```
2. **Set the Bridge:**
   Ensure the service is running on the `bridge` interface so all ethernet ports and WiFi are covered.

---

## Phase 5: Dashboard Management (API-SSL)
To see "Online" status and live speeds in the Movec Dashboard.

1. **Enable Secure API:**
   ```bash
   /ip service set api-ssl port=8729 disabled=no
   ```
2. **Firewall Authorization:**
   ```bash
   /ip firewall filter add chain=input protocol=tcp dst-port=8729 src-address=10.0.0.1 action=accept comment="Allow Movec Dashboard"
   ```

---

## Phase 6: Enrollment Checklist
When adding the router to the **Movec Dashboard**, use these settings:

| Field | Value |
| :--- | :--- |
| **Vendor** | MikroTik |
| **IP Address** | 10.0.0.3 (Your Tunnel IP) |
| **Port** | 8729 |
| **NAS IP** | 10.0.0.3 |
| **RADIUS Secret** | Movec@HomeLab#2026!Ke |

---

## Troubleshooting "No Connection"
1. **Logs**: Run `/log print where topics~"radius"`
2. **Auth Failed**: Ensure the PPPoE Server has **only** PAP selected.
3. **Timeout**: Check if you can ping `10.0.0.1`. If not, WireGuard is disconnected.
4. **Offline in Dashboard**: The dashboard now supports **Hybrid Monitoring**. Even if you select "RADIUS" vendor, the status will turn **Green** automatically if you provided the Admin Username/Password and port 8729 is reachable.

---
**END OF MANUAL**
