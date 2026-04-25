# MikroTik RouterOS Configuration Guide for Movec Connect

This manual provides a comprehensive, step-by-step guide for configuring a MikroTik gateway to integrate with the Movec Connect ISP Billing System.

## 1. Network Foundation (IP Pools)
First, define the address space for your subscribers.
```bash
/ip pool
add name=pppoe-pool ranges=10.0.0.2-10.0.3.254
```

## 2. PPPoE Service Configuration
### A. PPP Profiles (Speed Packages)
Create profiles that match the packages in the Movec Connect dashboard.
```bash
/ppp profile
add name="Home_Lite_10M" local-address=10.0.0.1 remote-address=pppoe-pool \
    rate-limit="10M/10M" dns-server=8.8.8.8,1.1.1.1
add name="Home_Standard_20M" local-address=10.0.0.1 remote-address=pppoe-pool \
    rate-limit="20M/20M" dns-server=8.8.8.8,1.1.1.1
```
### B. PPPoE Server
Enable the service on your LAN interface (e.g., bridge-lan).
```bash
/interface pppoe-server server
add disabled=no interface=bridge-lan service-name=Movec-PPPoE \
    authentication=pap,chap,mschap1,mschap2 keepalive-timeout=10 \
    max-mru=1492 max-mtu=1492 one-session-per-host=yes
```

## 3. Secure API Access (API-SSL)
Movec Connect communicates with your router via the RouterOS API. **SSL is mandatory for production.**

### A. Certificate Generation
```bash
/certificate
add name=api-ca common-name=MovecCA key-usage=key-cert-sign,crl-sign
sign api-ca
add name=api-server common-name=RouterIP_or_DNS
sign api-server ca=api-ca
```
### B. Enable API-SSL
```bash
/ip service
set api disabled=yes
set api-ssl certificate=api-server disabled=no port=8729
```

## 4. WireGuard Site-to-Site VPN
Used to bypass CGNAT (e.g., Starlink) and allow the backend to reach your router securely.

### A. WireGuard Interface
```bash
/interface wireguard
add listen-port=13231 name=wg-movec
/interface wireguard peers
add allowed-address=0.0.0.0/0 endpoint-address=YOUR_SERVER_IP \
    endpoint-port=51820 interface=wg-movec \
    public-key="SERVER_PUBLIC_KEY"
```
### B. Assign IP to Tunnel
```bash
/ip address
add address=10.255.255.2/30 interface=wg-movec
```

## 5. Security & Firewall
Protect your router while allowing management traffic.
```bash
/ip firewall filter
add action=accept chain=input comment="Allow Movec API via Tunnel" \
    dst-port=8729 protocol=tcp src-address=10.255.255.1
add action=accept chain=input comment="Allow WireGuard" \
    dst-port=13231 protocol=udp
```

## 6. Starlink Optimization
If using Starlink as WAN, ensure proper MSS clamping to prevent fragmentation.
```bash
/ip firewall mangle
add action=change-mss chain=forward new-mss=clamp-to-pmtu passthrough=yes \
    protocol=tcp tcp-flags=syn
```

## 7. Monitoring & Health
Movec Connect automatically tracks the following via API:
- `/system/resource`: CPU Load, Memory, Uptime
- `/system/health`: Voltage, Temperature (if supported)
- `/interface/monitor-traffic`: Real-time bandwidth usage
- `/ppp/active`: Live subscriber count

---
**Warning:** Never share your `ENCRYPTION_KEY` or RouterOS credentials. Ensure your firewall strictly limits API access to the Movec Backend IP or VPN Tunnel IP.
