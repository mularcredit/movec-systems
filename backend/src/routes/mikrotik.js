const express = require('express');
const router = express.Router();
const controller = require('../controllers/mikrotikController');
const requireAuth = require('../middlewares/requireAuth');

// --- All network routes require authentication ---
router.use(requireAuth);

// ── Static routes FIRST (must come before any :param routes) ─────────────────
router.get('/',              controller.getAllRouters);
router.get('/sessions/all', controller.getAllActiveSessions);
router.get('/overview',     controller.getGlobalNetworkOverview);
router.post('/test',        controller.testConnection);
router.post('/connect',     controller.linkRouter);

// ── Per-router operational endpoints ──────────────────────────────────────────
router.get ('/:router_id',             controller.getRouterDetails);
router.put ('/:router_id',             controller.updateRouter);
router.delete('/:router_id',          controller.deleteRouter);
router.post('/:router_id/sync',        controller.syncRouter);

// Subsystem data tabs
router.get('/:router_id/interfaces',  controller.getInterfaces);
router.get('/:router_id/hotspot',     controller.getHotspotProfiles);
router.get('/:router_id/pppoe',       controller.getPppoeProfiles);
router.get('/:router_id/dhcp',        controller.getDhcpLeases);
router.get('/:router_id/firewall',    controller.getFirewallRules);
router.get('/:router_id/wireless',    controller.getWirelessRegistrations);
router.get('/:router_id/stats',       controller.getRouterHealthStats);
router.get('/:router_id/scripts',     controller.getScriptsAndSchedulers);
router.get('/:router_id/monitor',     controller.getLiveTrafficMonitor);
// Profile readiness check — used by UI before creating customers to detect profile mismatches
// Optional query: ?package_name=10Mbps to validate a specific package against router profiles
router.get('/:router_id/profiles',    controller.getRouterProfiles);

// Session control
router.delete('/:router_id/pppoe-sessions/:session_id',    controller.killPppoeSession);
router.delete('/:router_id/hotspot-sessions/:session_id',  controller.killHotspotSession);

// Customer lifecycle
router.post('/:router_id/pppoe/suspend/:username',    controller.suspendPppSecret);
router.post('/:router_id/pppoe/reconnect/:username',  controller.reconnectPppSecret);

module.exports = router;
