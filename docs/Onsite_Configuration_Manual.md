# Onsite Configuration Manual: MikroTik & Movec Connect

This manual provides the exact, production-ready steps to configure a new MikroTik gateway and link it to the Movec Connect live environment.

## 1. Prerequisites (Production Values)
Before starting, ensure you have access to:
- **DigitalOcean IP**: `157.230.96.39`
- **WireGuard Server PubKey**: `ndm4e1CXE3FybrILFj0L5STlJWUW32x61hO4gLSoxhk=`
- **RADIUS Secret**: `Movec@HomeLab#2026!Ke`
- **Reserved Router Tunnel IP**: `10.9.35.32` (or next available in `10.9.x.x` range)

---

## Phase 1: Router Initialization (Single-Line Script)
Connect to the new MikroTik via Winbox or SSH. Open a **New Terminal** and paste the following single-line command. 

**Note:** This command assumes `ether1` is your WAN and all other ports are on a bridge named `bridge`.

```bash
/interface wireguard add listen-port=13231 name=wg-movec; /interface wireguard peers add allowed-address=0.0.0.0/0 endpoint-address=157.230.96.39 endpoint-port=51820 interface=wg-movec public-key="ndm4e1CXE3FybrILFj0L5STlJWUW32x61hO4gLSoxhk=" persistent-keepalive=25; /ip address add address=10.9.35.32/16 interface=wg-movec; /radius add address=157.230.96.39 secret="Movec@HomeLab#2026!Ke" service=ppp; /ppp profile add name="10Mbps Home" local-address=10.10.0.1 remote-address=pppoe-pool rate-limit="10M/10M" dns-server=8.8.8.8,1.1.1.1; /ppp profile add name="5Mbps Basic" local-address=10.10.0.1 remote-address=pppoe-pool rate-limit="5M/5M" dns-server=8.8.8.8,1.1.1.1; /ip pool add name=pppoe-pool ranges=10.10.1.1-10.10.1.254; /interface pppoe-server server add disabled=no interface=bridge service-name=Movec-Connect authentication=pap,chap,mschap1,mschap2 keepalive-timeout=10 one-session-per-host=yes use-radius=yes; /ip firewall nat add action=masquerade chain=srcnat out-interface=ether1 comment="Internet for Subscribers"; /ip dns set allow-remote-requests=yes servers=8.8.8.8,1.1.1.1; /certificate add name=api-ca common-name=MovecCA key-usage=key-cert-sign,crl-sign; /certificate sign api-ca; /certificate add name=api-server common-name=NewRouter; /certificate sign api-server ca=api-ca; /ip service set api-ssl certificate=api-server disabled=no port=8729; /ip service set api disabled=yes; /ip firewall filter add action=accept chain=input dst-port=8729 protocol=tcp src-address=10.9.0.1 comment="Allow Movec API";
```

---

## Phase 2: Security Handshake (Two-Way Tunnel)
The tunnel will not "up" until the server recognizes the router.

1.  **On the MikroTik**: Get your new router's public key.
    ```bash
    /interface wireguard print
    ```
    *Copy the `public-key` value.*

2.  **On the DigitalOcean Server**: Add the router as a peer.
    ```bash
    # Run this on the DigitalOcean terminal:
    wg set wg0 peer "PASTE_THE_ROUTER_PUBLIC_KEY" allowed-ips 10.9.35.32/32
    ```

3.  **Verification**: On the MikroTik, run `/interface wireguard peers print`. You should see `last-handshake` time update within 60 seconds.

---

## Phase 3: Movec Dashboard Integration
Now that the network is up, add the router to your billing software:

1.  Navigate to **Routers** > **Add Router**.
2.  **IP Address**: `10.9.35.32`
3.  **Port**: `8729` (Secure API).
4.  **Vendor**: `MikroTik`.
5.  **Authentication**: Enter the RouterOS admin credentials.
6.  **RADIUS NAS IP**: `10.9.35.32`.
7.  **RADIUS Secret**: `Movec@HomeLab#2026!Ke`.
